import { setActiveRoom } from './world/Collision.js';

// Switches the player between rooms. Every room shares one Three.js scene, so a
// "room" is really a set of scene children whose visibility we toggle, plus the
// collision data + interaction targets that go live while the player is inside.
//
// Room content is added to the scene by many builders (not one parent group),
// so each room is described by a flat list of the top-level objects that belong
// to it. Interaction targets are swapped explicitly rather than filtered by
// visibility, because a hidden group's child meshes still raycast.
//
//   const rooms = createRoomManager({ scene, player, interaction });
//   rooms.define('gallery', { layer, targets, spawn, segments, ground, ... });
//   rooms.start('gallery');   // apply without moving the player
//   rooms.enter('rococo');

// Run a builder and return both its value and whatever it added to the scene.
// Build EVERYTHING that belongs to a room inside the callback — including its
// door hitboxes and its lights — or it won't be hidden along with the room.
export function captureLayer(scene, build) {
  const before = new Set(scene.children);
  const value = build();
  return { value, layer: scene.children.filter((o) => !before.has(o)) };
}

export function createRoomManager({ scene, player, interaction }) {
  const rooms = new Map();
  let current = null;
  let onChange = null;

  function show(layer, visible) {
    for (const obj of layer) obj.visible = visible;
  }

  // def: { layer, targets, spawn, segments, ground, background?, bake?, onEnter? }
  // `bake` re-bakes that room's shadows: shadowMap.autoUpdate is off (see
  // Lighting.js), so every room switch has to ask for one fresh render.
  function define(id, def) {
    rooms.set(id, { targets: [], background: null, ...def });
    if (id !== current) show(def.layer, false);
    return rooms.get(id);
  }

  function apply(id, teleport) {
    const next = rooms.get(id);
    if (!next) throw new Error(`RoomManager: unknown room "${id}"`);
    if (current) show(rooms.get(current).layer, false);
    show(next.layer, true);
    current = id;                      // set before onEnter, so a re-entrant enter() no-ops
    scene.background = next.background;
    setActiveRoom({ segments: next.segments, ground: next.ground });
    interaction.setTargets(next.targets);
    // onEnter runs BEFORE the teleport: the gallery uses it to drop the lift
    // cabin back to ground level, and the spawn sits inside that cabin. Run it
    // after, and the first ground sample would yank the player up the shaft.
    next.onEnter?.();
    if (teleport) player.teleport(next.spawn.x, next.spawn.z, next.spawn.yaw);
    next.bake?.();
    onChange?.(id);
  }

  return {
    define,
    captureLayer: (build) => captureLayer(scene, build),
    has: (id) => rooms.has(id),
    enter(id) { if (id !== current) apply(id, true); },
    // Boot: make a room live without relocating the player. Collision.js seeds
    // its active room at module load, so without this the gallery's real
    // segments and ground function would never be installed.
    start(id) { apply(id, false); },
    get current() { return current; },
    // One observer for every room switch (enter and start alike), called with
    // the new id after the room is applied — main.js keys the foyer-only
    // music off it.
    set onChange(fn) { onChange = fn; },
  };
}
