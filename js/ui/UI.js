import { IS_TOUCH } from '../config.js';

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
      dialogue: document.getElementById('dialogue'),
      dialogueText: document.getElementById('dialogue-text'),
      dialogueChoices: document.getElementById('dialogue-choices'),
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
  _resume() { this.showPause(false); this.controls.lock(); }

  openArtwork(art) {
    this.activePanel = 'info';
    this.controls.unlock();
    this.prompt(null);
    this.el.infoTitle.textContent = art.title;
    this.el.infoMeta.textContent = `${art.year} · ${art.medium} · JFeelgood`;
    this.el.infoDesc.textContent = art.description;
    this.el.infoPrice.textContent = art.price;
    this.el.infoBuy.href = art.buyUrl;
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
    this.activePanel = null;
    if (!IS_TOUCH) this.controls.lock();
  }
}
