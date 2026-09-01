import { IS_TOUCH } from '../config.js';
import { GALLERY_INFO } from '../../data/artworks.js';
import { track } from '../utils/analytics.js';

// All DOM overlay state: HUD prompt, artwork panel, curator dialogue,
// pause screen, and the pointer-lock handshakes between them.

export class UI {
  constructor(controls) {
    this.controls = controls;
    this.activePanel = null;   // 'info' | 'dialogue' | null
    this.curator = null;       // injected by Curator module
    // Which room the visitor is standing in, so an enquiry reports the hall it
    // was made in as well as the piece. Set by main.js on every room change.
    this.room = null;
    this.hall = null;
    this.art = null;           // the piece the info panel is currently showing

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
      enquire: document.getElementById('enquire-btn'),
      infoContact: document.getElementById('info-contact'),
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
    this.el.enquire.addEventListener('click', () => this._enquire());

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

  // Where the visitor is. Only used to say which hall an enquiry was made in.
  setRoom(id, name) { this.room = id || null; this.hall = name || null; }

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

  // Full-screen wipe used by the lift and door travels between rooms. A pure
  // CSS transition — the caller times the room switch, so nothing here waits
  // on transitionend. `message` shows the "being prepared" line (index.html)
  // for hops that pause behind the veil to build a hall; its dots animate in
  // CSS so they keep moving while the build holds the main thread.
  veil(on, { message = false } = {}) {
    this.el.veil.classList.toggle('on', !!on);
    this.el.veil.classList.toggle('msg', !!on && !!message);
  }
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
    // The artist's details are built now but stay covered: a visitor who wants
    // them presses the enquiry button, which is the moment worth counting.
    // A piece with no contact on it shows neither, exactly as before.
    this.art = art;
    setContact(this.el.infoContact, art.contact);
    const hasContact = !this.el.infoContact.hidden;
    this.el.infoContact.hidden = true;
    this.el.enquire.hidden = !hasContact;
    this.el.info.hidden = false;
  }

  // The enquiry button: it stands down, the contact details take its place, and
  // Vercel Web Analytics is told which work was asked after. Fired from the
  // click rather than from the panel opening, so the dashboard counts intent
  // to buy and not everyone who read a wall label.
  _enquire() {
    const art = this.art;
    this.el.enquire.hidden = true;
    this.el.infoContact.hidden = !this.el.infoContact.childElementCount;
    track('Enquiry Opened', {
      work: art?.title || null,
      workId: art?.id || null,
      // the same name the label shows: the piece's own, or the house artist —
      // and null rather than '' for an uncredited hang, so the dashboard's
      // column stays readable
      artist: (art?.artist ?? GALLERY_INFO.artist) || null,
      series: art?.series || null,
      room: this.room,
      hall: this.hall,
      device: IS_TOUCH ? 'touch' : 'desktop',
    });
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
    this.art = null;
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

// The artist's own details, under the statement: a name, a line of what they
// do, a phone number, and a row per handle and site. Built as DOM nodes rather
// than an innerHTML string — a manifest is allowed to carry an apostrophe or an
// ampersand in a name, and this way one can never end up parsed as markup.
// Everything is optional; an entry with only a link renders only that link.
function setContact(el, contact) {
  el.textContent = '';
  if (contact) {
    const line = (cls, text) => {
      if (!text) return;
      const p = document.createElement('p');
      p.className = cls;
      p.textContent = text;
      el.appendChild(p);
    };
    line('contact-name', contact.name);
    line('contact-role', contact.role);
    if (contact.phone) {
      const p = document.createElement('p');
      p.className = 'contact-phone';
      // strip the number down for the href and leave the printed form alone
      p.appendChild(anchor(`tel:${contact.phone.replace(/[^\d+]/g, '')}`, contact.phone));
      el.appendChild(p);
    }
    for (const l of contact.links || []) {
      const row = document.createElement('p');
      row.className = 'contact-row';
      if (l.handle) {
        const h = document.createElement('span');
        h.className = 'contact-handle';
        h.textContent = l.handle;
        row.appendChild(h);
      }
      // The handle is plain text on purpose: the manifests give a handle without
      // saying which platform it is on, and guessing one would invent the link.
      if (l.url) row.appendChild(anchor(l.url, l.label || l.url));
      if (row.childElementCount) el.appendChild(row);
    }
  }
  el.hidden = !el.childElementCount;
}

// Every outbound link opens in a new tab. This one is a pointer-locked WebGL
// session with a room built in memory; navigating it away loses the gallery,
// and coming back means the loading screen and the lift ride again.
function anchor(href, text) {
  const a = document.createElement('a');
  a.href = href;
  a.textContent = text;
  if (!href.startsWith('tel:')) { a.target = '_blank'; a.rel = 'noopener noreferrer'; }
  return a;
}
