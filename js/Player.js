import * as THREE from 'three';
import { PLAYER } from './config.js';
import { SPAWN } from './world/layout.js';
import { resolveMovement, sampleGround } from './world/Collision.js';

// First-person rig. Movement intent comes from a controls module as
// { forward, strafe, running }; look comes in as yaw/pitch deltas.

export class Player {
  constructor(camera) {
    this.camera = camera;
    this.position = new THREE.Vector3(SPAWN.x, 0, SPAWN.z);
    this.walkY = 0;            // ground level under the player (analytic)
    this.smoothY = 0;          // eased camera base height
    this.yaw = SPAWN.yaw;
    this.pitch = 0;
    this.bobPhase = 0;
    this.bobAmount = 0;
    this.enabled = false;
    this._applyCamera();
  }

  // Instant relocation (room switch). Both room spawns sit on ground height 0,
  // so smoothY resets to 0 — no vertical ease glitch on arrival.
  teleport(x, z, yaw) {
    this.position.set(x, 0, z);
    this.walkY = 0;
    this.smoothY = 0;
    this.yaw = yaw;
    this.pitch = 0;
    this.bobPhase = 0;
    this.bobAmount = 0;
    this._applyCamera();
  }

  look(dYaw, dPitch) {
    this.yaw -= dYaw;
    this.pitch = THREE.MathUtils.clamp(this.pitch - dPitch, -Math.PI / 2 + 0.05, Math.PI / 2 - 0.05);
  }

  update(dt, intent) {
    if (this.enabled && (intent.forward !== 0 || intent.strafe !== 0)) {
      const speed = intent.running ? PLAYER.runSpeed : PLAYER.walkSpeed;
      const sin = Math.sin(this.yaw), cos = Math.cos(this.yaw);
      // forward is -Z in camera space rotated by yaw
      const dirX = -sin * intent.forward + cos * intent.strafe;
      const dirZ = -cos * intent.forward - sin * intent.strafe;
      const mag = Math.hypot(dirX, dirZ) || 1;
      const dx = (dirX / mag) * speed * dt;
      const dz = (dirZ / mag) * speed * dt;
      const res = resolveMovement(this.position, dx, dz, this.walkY);
      this.position.x = res.x;
      this.position.z = res.z;
      this.bobAmount = Math.min(1, this.bobAmount + dt * 4);
      this.bobPhase += dt * (intent.running ? 11 : 8);
    } else {
      this.bobAmount = Math.max(0, this.bobAmount - dt * 6);
    }

    this.walkY = sampleGround(this.position.x, this.position.z, this.walkY);
    const k = 1 - Math.exp(-12 * dt);
    this.smoothY += (this.walkY - this.smoothY) * k;
    this._applyCamera();
  }

  _applyCamera() {
    const bob = Math.sin(this.bobPhase) * 0.028 * this.bobAmount;
    this.camera.position.set(
      this.position.x,
      this.smoothY + PLAYER.eyeHeight + bob,
      this.position.z
    );
    this.camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
  }
}
