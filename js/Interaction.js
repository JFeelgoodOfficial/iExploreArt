import * as THREE from 'three';
import { PLAYER, IS_TOUCH } from './config.js';

// Center-screen raycasting against registered interactables (artwork
// canvases + the curator hitbox). Throttled; hover drives the HUD.

export class Interaction {
  constructor(camera, ui) {
    this.camera = camera;
    this.ui = ui;
    this.raycaster = new THREE.Raycaster();
    this.raycaster.far = PLAYER.interactDistance;
    this.targets = [];
    this.hovered = null;
    this._accum = 0;
    this.enabled = true;
  }

  register(meshes) { this.targets.push(...meshes); }

  // Replace the whole target set — used by the room switch so only the active
  // room's interactables are hittable (a hidden group's meshes still raycast).
  setTargets(list) { this.targets = list; this._setHovered(null); }

  update(dt) {
    this._accum += dt;
    if (this._accum < 0.1) return;
    this._accum = 0;
    if (!this.enabled) { this._setHovered(null); return; }

    this.camera.updateMatrixWorld();
    this.raycaster.setFromCamera(new THREE.Vector2(0, 0), this.camera);
    const hits = this.raycaster.intersectObjects(this.targets, false);
    this._setHovered(hits.length ? hits[0].object : null);
  }

  _setHovered(obj) {
    if (obj === this.hovered) return;
    if (this.hovered?.material?.emissive) this.hovered.material.emissive.setScalar(0);
    this.hovered = obj;
    if (!obj) { this.ui.prompt(null); return; }

    if (obj.material?.emissive) {
      if (obj.material.map && !obj.material.emissiveMap) {
        obj.material.emissiveMap = obj.material.map;
        obj.material.needsUpdate = true;
      }
      obj.material.emissive.setScalar(0.045);
    }
    const key = IS_TOUCH ? 'Tap' : '<b>E</b>';
    if (obj.userData.artwork) {
      this.ui.prompt(`${key} — view “${obj.userData.artwork.title}”`);
    } else if (obj.userData.curator) {
      this.ui.prompt(`${key} — speak with the curator`);
    } else if (obj.userData.door) {
      this.ui.prompt(`${key} — ${obj.userData.door.label}`);
    } else if (obj.userData.lift) {
      this.ui.prompt(`${key} — use the lift`);
    }
  }

  // returns true if something was activated
  activate() {
    const obj = this.hovered;
    if (!obj) return false;
    if (obj.userData.artwork) { this.ui.openArtwork(obj.userData.artwork); return true; }
    if (obj.userData.curator) { this.ui.openDialogue(); return true; }
    if (obj.userData.door) { obj.userData.door.onEnter(); return true; }
    if (obj.userData.lift) { obj.userData.lift.open(); return true; }
    return false;
  }
}
