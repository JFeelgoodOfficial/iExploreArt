import * as THREE from 'three';
import { CURATOR_POS } from '../world/layout.js';
import { DIALOGUE } from '../../data/dialogue.js';
import { ARTWORKS } from '../../data/artworks.js';

// Mira, the curator: a stylized figure behind the reception desk with a
// breathing idle and head-tracking, plus the dialogue-tree runner that the
// UI renders. Purchases route to minicuration.com from here.

export class Curator {
  constructor(scene, mats, ui, player) {
    this.ui = ui;
    this.player = player;
    ui.curator = this;

    const g = new THREE.Group();
    g.name = 'curator';
    g.position.set(CURATOR_POS.x, 0, CURATOR_POS.z);
    g.rotation.y = CURATOR_POS.facing;

    const skin = new THREE.MeshStandardMaterial({ color: 0xc9a284, roughness: 0.75 });
    const coat = new THREE.MeshStandardMaterial({ color: 0x2f6f73, roughness: 0.85 });
    const hairM = new THREE.MeshStandardMaterial({ color: 0x241d18, roughness: 0.9 });

    // long curator's coat — a tapered capsule-ish form
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.23, 1.18, 14), coat);
    body.position.y = 0.95;
    // shoulders
    const shoulders = new THREE.Mesh(new THREE.SphereGeometry(0.185, 14, 10), coat);
    shoulders.position.y = 1.52;
    shoulders.scale.set(1, 0.55, 0.8);
    // arms, relaxed
    const armGeo = new THREE.CylinderGeometry(0.045, 0.05, 0.62, 8);
    const armL = new THREE.Mesh(armGeo, coat);
    armL.position.set(-0.225, 1.18, 0.02);
    armL.rotation.z = 0.09;
    const armR = armL.clone();
    armR.position.x = 0.225;
    armR.rotation.z = -0.09;

    // head group (pivots for look-at)
    this.head = new THREE.Group();
    this.head.position.y = 1.66;
    const skull = new THREE.Mesh(new THREE.SphereGeometry(0.115, 16, 12), skin);
    skull.scale.set(0.92, 1.05, 0.98);
    const hair = new THREE.Mesh(new THREE.SphereGeometry(0.121, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.62), hairM);
    hair.position.y = 0.015;
    hair.scale.set(0.95, 1.06, 1.0);
    hair.rotation.x = -0.35;
    this.head.add(skull, hair);

    this.torso = new THREE.Group();
    this.torso.add(body, shoulders, armL, armR, this.head);
    g.add(this.torso);

    g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });

    // interaction hitbox spans the figure + desk approach
    const hitbox = new THREE.Mesh(
      new THREE.BoxGeometry(1.0, 2.0, 1.2),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    hitbox.position.set(0, 1.0, 0);
    hitbox.userData.curator = true;
    g.add(hitbox);
    this.hitbox = hitbox;

    scene.add(g);
    this.group = g;
    this._baseYaw = CURATOR_POS.facing;
    this._lookWeight = 0;
  }

  get interactables() { return [this.hitbox]; }

  update(dt, t) {
    // breathing
    const breathe = 1 + Math.sin(t * 1.7) * 0.012;
    this.torso.scale.set(1, breathe, 1);

    // head (and gently the body) turns toward a nearby visitor
    const p = this.player.position;
    const dx = p.x - this.group.position.x;
    const dz = p.z - this.group.position.z;
    const dist = Math.hypot(dx, dz);
    const targetWeight = dist < 5 && Math.abs(this.player.walkY) < 0.5 ? 1 : 0;
    this._lookWeight += (targetWeight - this._lookWeight) * (1 - Math.exp(-4 * dt));

    if (this._lookWeight > 0.01) {
      const worldYaw = Math.atan2(dx, dz);
      let rel = worldYaw - this._baseYaw;
      rel = Math.atan2(Math.sin(rel), Math.cos(rel));
      rel = THREE.MathUtils.clamp(rel, -1.1, 1.1);
      this.head.rotation.y = rel * this._lookWeight;
      this.torso.rotation.y = rel * 0.25 * this._lookWeight;
      // subtle nod toward eye height difference
      const eyeDy = (this.player.camera.position.y - (this.group.position.y + 1.66));
      this.head.rotation.x = THREE.MathUtils.clamp(-Math.atan2(eyeDy, dist) * 0.5, -0.3, 0.25) * this._lookWeight;
    } else {
      this.head.rotation.y *= 0.95;
      this.head.rotation.x *= 0.95;
      this.torso.rotation.y *= 0.95;
    }
  }

  // ---- dialogue runner ----------------------------------------------------
  startConversation() { this._showNode('start'); }

  _showNode(id) {
    const node = DIALOGUE[id];
    if (!node) { this.ui.closePanel(); return; }
    this.ui.showDialogueNode(node.text, node.choices, (choice) => this._choose(choice));
  }

  _choose(choice) {
    if (choice.action) {
      const a = choice.action;
      if (a.type === 'link') {
        window.open(a.url, '_blank', 'noopener');
        this._showNode('start');
        return;
      }
      if (a.type === 'artworkList') {
        const works = ARTWORKS.filter(w => w.slot.startsWith(a.floor));
        const label = a.floor === 'G' ? 'the ground floor' : a.floor === 'M' ? 'the upper gallery' : 'the courtyard';
        const choices = works.map(w => ({
          label: `${w.title} — ${w.price}`,
          action: { type: 'artwork', id: w.id },
        }));
        choices.push({ label: 'Back.', next: 'collection' });
        this.ui.showDialogueNode(
          `On ${label} you’ll find ${works.length} works. Ask me about any of them:`,
          choices,
          (c) => this._choose(c)
        );
        return;
      }
      if (a.type === 'artwork') {
        const art = ARTWORKS.find(w => w.id === a.id);
        if (art) { this.ui.closePanel(); this.ui.openArtwork(art); }
        return;
      }
    }
    if (choice.next) this._showNode(choice.next);
    else this.ui.closePanel();
  }
}
