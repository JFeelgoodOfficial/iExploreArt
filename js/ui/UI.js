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
      infoSpec: document.getElementById('info-spec'),
      infoSeries: document.getElementById('info-series'),
      infoDesc: document.getElementById('info-desc'),
      dialogue: document.getElementById('dialogue'),
      dialogueText: document.getElementById('dialogue-text'),
      dialogueChoices: document.getElementById('dialogue-choices'),
      lift: document.getElementById('lift-panel'),
      liftSpeaker: document.getElementById('lift-speaker'),
      liftText: document.getElementById('lift-text'),
      liftChoices: document.getElementById('lift-choices'),
      veil: document.getElementById('veil'),
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

  // Full-screen wipe used by the lift between rooms. A pure CSS transition —
  // the caller times the room switch, so nothing here waits on transitionend.
  veil(on) { this.el.veil.classList.toggle('on', !!on); }
  _resume() { this.showPause(false); this.controls.lock(); }

  // true when a full-screen overlay (info/dialogue panel or the pause screen)
  // covers the canvas — the render loop throttles behind it.
  isObscured() { return !!this.activePanel || !this.el.pause.hidden; }

  openArtwork(art) {
    this.activePanel = 'info';
    this.controls.unlock();
    this.prompt(null);
    // The panel is a wall label: the work's title, who made it, and whatever
    // else the manifest actually knows. Every line below the artist is
    // optional and hides itself when the piece has nothing to put there, so a
    // manifest that only carries a title still reads as a clean label.
    //
    // The house artist unless the piece names its own — the residency halls hang
    // visiting artists, whose works carry `artist`. An empty string is a
    // deliberate blank (an uncredited hang), so it isn't filled in from the house.
    this.el.infoTitle.textContent = art.title;
    this.el.infoMeta.textContent = art.artist ?? GALLERY_INFO.artist;
    // Year, medium and size on one line, in that order, separated the way a
    // printed label does it. Any of the three may be missing.
    setLine(this.el.infoSpec, [art.year, art.medium, art.dims].filter(Boolean).join(' · '));
    setLine(this.el.infoSeries, art.series);
    setLine(this.el.infoDesc, art.description);
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

// One optional label line: fill it and show it, or empty it and take it out of
// the flow. `hidden` rather than display:none in JS so the panel's own CSS
// keeps control of how each line looks.
function setLine(el, text) {
  const t = (text || '').trim();
  el.textContent = t;
  el.hidden = !t;
}
