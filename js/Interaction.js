import * as THREE from 'three';
import { PLAYER, IS_TOUCH } from './config.js';

// Center-screen raycasting against registered interactables (artwork
// canvases + the curator hitbox). Throttled; hover drives the HUD.
//
// Alongside that there is a STANDING action: something you are on rather than
// something you are looking at. A lift platform is the case it exists for —
// aiming at a 38 mm call button is a poor way to ask for a floor when you are
// already in the cab. It answers wherever you look, but only when the ray hits
// nothing, so a painting seen from inside a cab still opens as a painting.

export class Interaction {
  constructor(camera, ui) {
    this.camera = camera;
    this.ui = ui;
    this.raycaster = new THREE.Raycaster();
    this.raycaster.far = PLAYER.interactDistance;
    this.targets = [];
    this.hovered = null;
    this.standing = null;
    this._promptHtml = null;
    this._accum = 0;
    this.enabled = true;
  }

  register(meshes) { this.targets.push(...meshes); }

  // Replace the whole target set — used by the room switch so only the active
  // room's interactables are hittable (a hidden group's meshes still raycast).
  // The standing action goes with them: it belongs to the room being left.
  setTargets(list) { this.targets = list; this.standing = null; this._setHovered(null); }

  // `action` is the same { label, open } contract the hover targets carry, or
  // null when the player isn't standing on anything that offers one.
  setStanding(action) {
    if (action === this.standing) return;
    this.standing = action;
    if (!this.hovered) this._promptStanding();
  }

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

  // Every prompt goes through here. With nothing under the crosshair the
  // standing prompt has to be re-evaluated on each pass — `enabled` and
  // `standing` both change without the hovered object changing — so the write
  // itself is what gets guarded, not the call.
  _prompt(html) {
    if (html === this._promptHtml) return;
    this._promptHtml = html;
    this.ui.prompt(html);
  }

  _promptStanding() {
    const key = IS_TOUCH ? 'Tap' : '<b>E</b>';
    this._prompt(this.standing && this.enabled ? `${key} — ${this.standing.label}` : null);
  }

  _setHovered(obj) {
    // null → null still falls through: the standing prompt may have changed
    if (obj && obj === this.hovered) return;
    if (this.hovered?.material?.emissive) this.hovered.material.emissive.setScalar(0);
    this.hovered = obj;
    if (!obj) { this._promptStanding(); return; }

    if (obj.material?.emissive) {
      if (obj.material.map && !obj.material.emissiveMap) {
        obj.material.emissiveMap = obj.material.map;
        obj.material.needsUpdate = true;
      }
      obj.material.emissive.setScalar(0.045);
    }
    const key = IS_TOUCH ? 'Tap' : '<b>E</b>';
    if (obj.userData.artwork) {
      this._prompt(`${key} — view “${obj.userData.artwork.title}”`);
    } else if (obj.userData.curator) {
      this._prompt(`${key} — speak with the curator`);
    } else if (obj.userData.door) {
      this._prompt(`${key} — ${obj.userData.door.label}`);
    } else if (obj.userData.lift) {
      this._prompt(`${key} — use the lift`);
    }
  }

  // returns true if something was activated
  activate() {
    const obj = this.hovered;
    // nothing under the crosshair — fall through to whatever you're standing on
    if (!obj) {
      if (!this.standing || !this.enabled) return false;
      this.standing.open();
      return true;
    }
    if (obj.userData.artwork) { this.ui.openArtwork(obj.userData.artwork); return true; }
    if (obj.userData.curator) { this.ui.openDialogue(); return true; }
    if (obj.userData.door) { obj.userData.door.onEnter(); return true; }
    if (obj.userData.lift) { obj.userData.lift.open(); return true; }
    return false;
  }
}
