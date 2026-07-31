import { IS_TOUCH } from '../config.js';
import { GALLERY_INFO } from '../../data/artworks.js';

// All DOM overlay state: HUD prompt, artwork panel, curator dialogue,
// pause screen, and the pointer-lock handshakes between them.

export class UI {
  constructor(controls) {
    this.controls = controls;
    this.activePanel = null;   // 'info' | 'dialogue' | null
    this.curator = null;       // injected by Curator module

    this.el = {
      hud: document.getElementById('hud'),
      crosshair: document.getElementById('crosshair'),
      prompt: document.getElementById('prompt'),
      pause: document.getElementById('pause'),
      info: document.getElementById('info-panel'),
      infoTitle: document.getElementById('info-title'),
      infoMeta: document.getElementById('info-meta'),
      infoDesc: document.getElementById('info-desc'),
      infoPrice: document.getElementById('info-price'),
      infoBuy: document.getElementById('info-buy'),
      infoFineprint: document.getElementById('info-fineprint'),
      dialogue: document.getElementById('dialogue'),
      dialogueText: document.getElementById('dialogue-text'),
      dialogueChoices: document.getElementById('dialogue-choices'),
      lift: document.getElementById('lift-panel'),
      liftSpeaker: document.getElementById('lift-speaker'),
      liftText: document.getElementById('lift-text'),
      liftChoices: document.getElementById('lift-choices'),
      veil: document.getElementById('veil'),
      rideDest: document.getElementById('ride-dest'),
    };

    document.getElementById('resume-btn').addEventListener('click', () => this._resume());
    this.el.info.querySelector('[data-close]').addEventListener('click', () => this.closePanel());

    controls.onLockChange = (locked) => {
      if (!locked && !this.activePanel && this.entered) this.showPause(true);
      if (locked) this.showPause(false);
    };

    document.addEventListener('keydown', (e) => {
      if (e.code === 'Escape' && this.activePanel) this.closePanel();
    });

    this.entered = false;
  }

  enter() { this.entered = true; this.el.hud.hidden = false; }

  prompt(html) {
    if (html) {
      this.el.prompt.innerHTML = html;
      this.el.prompt.hidden = false;
      this.el.crosshair.classList.add('active');
    } else {
      this.el.prompt.hidden = true;
      this.el.crosshair.classList.remove('active');
    }
  }

  showPause(show) { this.el.pause.hidden = !show; }

  // Full-screen wipe used between rooms, for doorways you walk through. A pure
  // CSS transition — the caller times the room switch, so nothing here waits on
  // transitionend.
  veil(on) { this.el.veil.classList.toggle('on', !!on); }

  // The same wipe dressed as a lift ride: the leaves shut over the room you're
  // leaving, the light of passing floors runs under the door while the
  // destination is built, and the leaves part on the new hall.
  //
  // Everything after this call is CSS. It has to be: a first ride to Nouveau or
  // Rococo builds the room synchronously behind the door (main.js ensureRoom),
  // and the several seconds that takes belong to the main thread — a JS-driven
  // overlay would freeze solid right where the wait is longest, which is the
  // problem this replaced. Transform and opacity keep running on the compositor.
  //
  //   dest    — the name over the seam
  //   dir     — 'up' | 'down', which way the floors go past
  //   instant — skip the closing slide. The reception lift's own bronze leaves
  //             have already shut in front of you by the time it veils, so
  //             sliding a second pair over them reads as a stutter.
  ride({ dest = '', dir = 'up', instant = false } = {}) {
    const v = this.el.veil;
    this.el.rideDest.textContent = dest;
    clearTimeout(this._rideT);
    v.classList.remove('up', 'down', 'instant', 'done', 'noanim');
    v.classList.add('ride', dir);
    if (instant) {
      // Land shut without sliding, then hand the transition straight back so
      // the leaves still part on arrival.
      v.classList.add('instant', 'noanim', 'shut');
      void v.offsetHeight;
      v.classList.remove('noanim');
    } else {
      // Flush the open state first, or the leaves are born shut and there is
      // nothing to animate. A reflush rather than a rAF: rAF is paced by the
      // render loop, which on a slow machine is exactly where this is needed
      // and exactly where frames are scarce.
      void v.offsetHeight;
      v.classList.add('shut');
    }
  }

  rideEnd() {
    const v = this.el.veil;
    if (!v.classList.contains('ride')) return;
    v.classList.remove('shut');            // the leaves part on the new room
    clearTimeout(this._rideT);
    this._rideT = setTimeout(() => {
      // Blank it while still in ride mode (where the veil has no transition),
      // then drop the classes a frame later, so the black fill never fades
      // back in over the room that just arrived.
      v.classList.add('done');
      void v.offsetHeight;
      v.classList.remove('ride', 'on', 'up', 'down', 'instant', 'noanim', 'done');
    }, 620);                               // the 0.55 s slide, plus a margin
  }

  _resume() { this.showPause(false); this.controls.lock(); }

  // true when a full-screen overlay (info/dialogue panel or the pause screen)
  // covers the canvas — the render loop throttles behind it.
  isObscured() { return !!this.activePanel || !this.el.pause.hidden; }

  openArtwork(art) {
    this.activePanel = 'info';
    this.controls.unlock();
    this.prompt(null);
    this.el.infoTitle.textContent = art.title;
    // the house artist unless the piece names its own — the residency halls hang
    // visiting artists, whose works carry `artist` and `series`
    this.el.infoMeta.textContent = [art.year, art.medium, art.series, art.artist || GALLERY_INFO.artist]
      .filter(Boolean).join(' · ');
    this.el.infoDesc.textContent = art.description;
    // price / buy link are optional — hide them when a piece has none. The
    // fineprint only describes the buy link, so it goes with it; the residency
    // works carry no buyUrl and would otherwise be left naming a checkout that
    // isn't on screen.
    this.el.infoPrice.textContent = art.price || '';
    this.el.infoPrice.hidden = !art.price;
    if (art.buyUrl) {
      this.el.infoBuy.href = art.buyUrl;
      this.el.infoBuy.hidden = false;
    } else {
      this.el.infoBuy.removeAttribute('href');
      this.el.infoBuy.hidden = true;
    }
    this.el.infoFineprint.hidden = !art.buyUrl;
    this.el.info.hidden = false;
  }

  openDialogue() {
    if (!this.curator) return;
    this.activePanel = 'dialogue';
    this.controls.unlock();
    this.prompt(null);
    this.el.dialogue.hidden = false;
    this.curator.startConversation();
  }

  // Elevator picker: a button per destination; picking one rides the lift.
  // currentIndex of -1 means "you aren't anywhere in this list" — the reception
  // lift, whose destinations are other rooms rather than floors of this one.
  openLift(labels, currentIndex, onSelect, opts = {}) {
    this.activePanel = 'lift';
    this.controls.unlock();
    this.prompt(null);
    this.el.liftSpeaker.textContent = opts.speaker || 'Lift';
    this.el.liftText.textContent = opts.title || 'Select a floor';
    this.el.liftChoices.innerHTML = '';
    labels.forEach((label, i) => {
      const btn = document.createElement('button');
      if (i === currentIndex) btn.classList.add('here');
      btn.innerHTML = `<span class="arrow">▲</span>${label}${i === currentIndex ? ' — you are here' : ''}`;
      btn.addEventListener('click', () => { this.closePanel(); onSelect(i); });
      this.el.liftChoices.appendChild(btn);
    });
    this.el.lift.hidden = false;
  }

  // called by the curator's dialogue runner for each node
  showDialogueNode(text, choices, onChoose) {
    this.el.dialogueText.textContent = text;
    this.el.dialogueChoices.innerHTML = '';
    for (const c of choices) {
      const btn = document.createElement('button');
      btn.innerHTML = `<span class="arrow">→</span>${c.label}`;
      btn.addEventListener('click', () => onChoose(c));
      this.el.dialogueChoices.appendChild(btn);
    }
  }

  closePanel() {
    this.el.info.hidden = true;
    this.el.dialogue.hidden = true;
    this.el.lift.hidden = true;
    this.activePanel = null;
    if (!IS_TOUCH) this.controls.lock();
  }
}
