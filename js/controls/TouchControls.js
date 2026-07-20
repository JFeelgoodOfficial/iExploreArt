// Mobile controls: left-half virtual joystick to walk, right-half drag to
// look, short tap to interact. Mirrors the DesktopControls interface.

export class TouchControls {
  constructor(canvas, player) {
    this.canvas = canvas;
    this.player = player;
    this.intent = { forward: 0, strafe: 0, running: false };
    this.onInteract = null;
    this.onLockChange = null;
    this.locked = false;

    this.joyEl = document.getElementById('joystick');
    this.nubEl = this.joyEl.querySelector('.nub');
    this._moveId = null;
    this._lookId = null;
    this._joyCenter = { x: 0, y: 0 };
    this._lookLast = { x: 0, y: 0 };
    this._tapStart = null;

    canvas.addEventListener('pointerdown', (e) => this._down(e));
    canvas.addEventListener('pointermove', (e) => this._move(e));
    canvas.addEventListener('pointerup', (e) => this._up(e));
    canvas.addEventListener('pointercancel', (e) => this._up(e));
  }

  lock() { this.locked = true; this.player.enabled = true; }
  unlock() { /* panels handle their own dismissal on touch */ }
  update() {}

  _down(e) {
    if (!this.locked) return;
    if (e.clientX < window.innerWidth / 2 && this._moveId === null) {
      this._moveId = e.pointerId;
      this._joyCenter = { x: e.clientX, y: e.clientY };
      this.joyEl.style.left = `${e.clientX - 59}px`;
      this.joyEl.style.top = `${e.clientY - 59}px`;
      this.joyEl.classList.add('visible');
      this.canvas.setPointerCapture(e.pointerId);
    } else if (this._lookId === null) {
      this._lookId = e.pointerId;
      this._lookLast = { x: e.clientX, y: e.clientY };
      this._tapStart = { x: e.clientX, y: e.clientY, t: performance.now() };
      this.canvas.setPointerCapture(e.pointerId);
    }
  }

  _move(e) {
    if (e.pointerId === this._moveId) {
      const dx = e.clientX - this._joyCenter.x;
      const dy = e.clientY - this._joyCenter.y;
      const len = Math.hypot(dx, dy);
      const max = 52;
      const cl = Math.min(len, max);
      const nx = len > 0 ? (dx / len) * cl : 0;
      const ny = len > 0 ? (dy / len) * cl : 0;
      this.nubEl.style.transform = `translate(${nx}px, ${ny}px)`;
      this.intent.strafe = nx / max;
      this.intent.forward = -ny / max;
      this.intent.running = len > max * 1.15;
    } else if (e.pointerId === this._lookId) {
      const dx = e.clientX - this._lookLast.x;
      const dy = e.clientY - this._lookLast.y;
      this._lookLast = { x: e.clientX, y: e.clientY };
      this.player.look(dx * 0.0042, dy * 0.0042);
      if (this._tapStart && Math.hypot(e.clientX - this._tapStart.x, e.clientY - this._tapStart.y) > 12) {
        this._tapStart = null;
      }
    }
  }

  _up(e) {
    if (e.pointerId === this._moveId) {
      this._moveId = null;
      this.intent.forward = 0;
      this.intent.strafe = 0;
      this.intent.running = false;
      this.nubEl.style.transform = 'translate(0px, 0px)';
      this.joyEl.classList.remove('visible');
    } else if (e.pointerId === this._lookId) {
      if (this._tapStart && performance.now() - this._tapStart.t < 260 && this.onInteract) {
        this.onInteract();
      }
      this._lookId = null;
      this._tapStart = null;
    }
  }
}
