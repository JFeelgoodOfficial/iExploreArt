// Pointer-lock mouse look + WASD/arrow movement. Exposes the same interface
// as TouchControls: .intent {forward,strafe,running}, .onInteract callback,
// .lock()/.unlock(), and lock-state change events for the UI layer.

export class DesktopControls {
  constructor(canvas, player) {
    this.canvas = canvas;
    this.player = player;
    this.intent = { forward: 0, strafe: 0, running: false };
    this.onInteract = null;
    this.onLockChange = null;
    this.keys = new Set();

    canvas.addEventListener('click', () => {
      if (!this.locked) canvas.requestPointerLock();
    });

    document.addEventListener('pointerlockchange', () => {
      const locked = this.locked;
      this.player.enabled = locked;
      if (!locked) { this.keys.clear(); this._updateIntent(); }
      if (this.onLockChange) this.onLockChange(locked);
    });

    document.addEventListener('mousemove', (e) => {
      if (!this.locked) return;
      this.player.look(e.movementX * 0.0022, e.movementY * 0.0022);
    });

    document.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      if (e.code === 'KeyE' && this.locked && this.onInteract) this.onInteract();
      this.keys.add(e.code);
      this._updateIntent();
    });
    document.addEventListener('keyup', (e) => {
      this.keys.delete(e.code);
      this._updateIntent();
    });
  }

  get locked() { return document.pointerLockElement === this.canvas; }

  lock() { this.canvas.requestPointerLock(); }
  unlock() { if (this.locked) document.exitPointerLock(); }

  _updateIntent() {
    const k = this.keys;
    this.intent.forward = (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0) - (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0);
    this.intent.strafe = (k.has('KeyD') || k.has('ArrowRight') ? 1 : 0) - (k.has('KeyA') || k.has('ArrowLeft') ? 1 : 0);
    this.intent.running = k.has('ShiftLeft') || k.has('ShiftRight');
  }

  update() {}
}
