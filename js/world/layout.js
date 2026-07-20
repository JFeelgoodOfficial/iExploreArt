// Single source of truth for the gallery architecture.
// Coordinates: X east (0..24), Z south (0..14), Y up. All units meters.
// North wall (z=0) holds the city window; south wall (z=14) is the courtyard glass.

export const ROOM = {
  w: 24,           // x extent
  d: 14,           // z extent
  mezzY: 4.0,      // mezzanine floor level
  roofY: 7.5,      // atrium ceiling
  slab: 0.25,      // mezzanine slab thickness
  wallT: 0.3,      // wall thickness
};

// North window: between the structural piers, double height.
export const WINDOW_N = { x0: 7, x1: 17, sill: 0.8, head: 6.5 };
// South courtyard glazing: floor to mezzanine level.
export const GLASS_S = { x0: 2, x1: 22, y0: 0, y1: 4.0 };
// Skylight opening in the roof above the atrium void.
export const SKYLIGHT = { x0: 9, x1: 15, z0: 3, z1: 7 };

// Stairs: straight flight with mid landing, hugging the east wall.
// Channel is x in [22.2, 24]; player ground height follows ramp(z).
export const STAIR = {
  x0: 22.2, x1: 24,
  entryZ: 1.8,               // north end of the balustrade / channel
  run1: { z0: 2.0, z1: 4.8, y0: 0, y1: 2 },
  landing: { z0: 4.8, z1: 6.0, y: 2 },
  run2: { z0: 6.0, z1: 8.8, y0: 2, y1: 4 },
  topZ: 9.0,                 // where the flight meets the mezzanine slab
};

// Stairwell void cut into the east mezzanine slab.
export const STAIR_VOID = { x0: 22, x1: 24, z0: 1.6, z1: 9.0 };

// Mezzanine slab rectangles (top surface at ROOM.mezzY).
export const MEZZ_RECTS = [
  { x0: 0, x1: 7, z0: 0, z1: 14 },     // west balcony
  { x0: 17, x1: 22, z0: 0, z1: 14 },   // east balcony (west of stairwell)
  { x0: 22, x1: 24, z0: 0, z1: 1.6 },  // east strip north of stairwell
  { x0: 22, x1: 24, z0: 9.0, z1: 14 }, // east strip south of stairwell (stair landing)
  { x0: 7, x1: 17, z0: 11.2, z1: 14 }, // south bridge
];
// The atrium void (open to below): x 7..17, z 0..11.2.

// Freestanding gallery wall on the ground floor.
export const FREE_WALL = { x0: 10, x1: 14, z0: 6.8, z1: 7.2, h: 3.2 };

// Reception desk against the west wall, south of the entry door.
export const DESK = { x0: 1.6, x1: 2.4, z0: 10.8, z1: 13.2, h: 1.08 };
export const DOOR = { z0: 8.5, z1: 10.5, h: 2.4 };  // visual only, west wall

export const SPAWN = { x: 2.6, z: 9.5, yaw: -Math.PI / 2 }; // facing east (+X)

export const CURATOR_POS = { x: 0.95, z: 12.0, facing: Math.PI / 2 };

// Furniture footprints (also become colliders).
export const BENCHES = [
  { x: 12, z: 4.2, w: 1.9, d: 0.62, ry: 0 },     // faces the city window
  { x: 12, z: 10.0, w: 1.9, d: 0.62, ry: Math.PI }, // faces the courtyard
];
export const PLINTHS = [
  { x: 9, z: 2.6, s: 0.55 },
  { x: 15, z: 2.6, s: 0.55 },
  { x: 18.6, z: 10.6, s: 0.55 },
];
export const POTS = [
  { x: 0.8, z: 0.8 }, { x: 23.2, z: 13.3 }, { x: 21.2, z: 0.9 },
];

// ---------------------------------------------------------------------------
// Painting slots. normal = direction the artwork faces (out of the wall).
// maxW limits artwork width; placement code preserves the artwork aspect.
export const SLOTS = [
  // ground floor
  { id: 'G-W1', pos: [0.16, 1.7, 4.0], n: [1, 0, 0], maxW: 2.0 },
  { id: 'G-W2', pos: [0.16, 1.7, 6.6], n: [1, 0, 0], maxW: 1.6 },
  { id: 'G-N1', pos: [3.5, 1.8, 0.16], n: [0, 0, 1], maxW: 2.6 },
  { id: 'G-N2', pos: [20.5, 1.8, 0.16], n: [0, 0, 1], maxW: 2.6 },
  { id: 'G-F1', pos: [11.0, 1.7, 6.79], n: [0, 0, -1], maxW: 1.5 },
  { id: 'G-F2', pos: [13.0, 1.7, 6.79], n: [0, 0, -1], maxW: 1.5 },
  { id: 'G-F3', pos: [11.0, 1.7, 7.21], n: [0, 0, 1], maxW: 1.5 },
  { id: 'G-F4', pos: [13.0, 1.7, 7.21], n: [0, 0, 1], maxW: 1.5 },
  { id: 'G-E1', pos: [23.84, 1.7, 11.5], n: [-1, 0, 0], maxW: 2.2 },
  // mezzanine
  { id: 'M-W1', pos: [0.16, 5.7, 3.5], n: [1, 0, 0], maxW: 2.0 },
  { id: 'M-W2', pos: [0.16, 5.7, 7.5], n: [1, 0, 0], maxW: 2.0 },
  { id: 'M-N1', pos: [3.5, 5.8, 0.16], n: [0, 0, 1], maxW: 2.6 },
  { id: 'M-N2', pos: [20.5, 5.8, 0.16], n: [0, 0, 1], maxW: 2.6 },
  { id: 'M-E1', pos: [23.84, 5.7, 11.8], n: [-1, 0, 0], maxW: 2.2 },
  { id: 'M-S1', pos: [10.0, 5.8, 13.84], n: [0, 0, -1], maxW: 2.2 },
  { id: 'M-S2', pos: [14.0, 5.8, 13.84], n: [0, 0, -1], maxW: 2.2 },
];

// ---------------------------------------------------------------------------
// Ground height. prevY lets the same XZ carry both ground floor and mezzanine:
// a player is only assigned the upper level if they are already up there
// (the stairs are the one continuous connector; railings guard every edge).
export function groundHeight(x, z, prevY = 0) {
  if (x >= STAIR.x0 && x <= STAIR.x1 && z >= STAIR.entryZ && z <= STAIR_VOID.z1) {
    return stairRamp(z);
  }
  if (prevY > 2.2 && inMezzanine(x, z)) return ROOM.mezzY;
  return 0;
}

export function stairRamp(z) {
  const s = STAIR;
  if (z <= s.run1.z0) return 0;
  if (z <= s.run1.z1) return lin(z, s.run1.z0, s.run1.z1, s.run1.y0, s.run1.y1);
  if (z <= s.landing.z1) return s.landing.y;
  if (z <= s.run2.z1) return lin(z, s.run2.z0, s.run2.z1, s.run2.y0, s.run2.y1);
  return ROOM.mezzY;
}

export function inMezzanine(x, z) {
  return MEZZ_RECTS.some(r => x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1);
}

function lin(v, a, b, y0, y1) { return y0 + (y1 - y0) * Math.min(1, Math.max(0, (v - a) / (b - a))); }

// ---------------------------------------------------------------------------
// Collision segments. Each: { a:[x,z], b:[x,z], level } where level is the
// walking height at which the segment is solid ('all' = every level).
function seg(ax, az, bx, bz, level = 'all') { return { a: [ax, az], b: [bx, bz], level }; }

function rect(x0, z0, x1, z1, level = 'all') {
  return [seg(x0, z0, x1, z0, level), seg(x1, z0, x1, z1, level),
          seg(x1, z1, x0, z1, level), seg(x0, z1, x0, z0, level)];
}

export function buildColliders() {
  const c = [];
  // perimeter
  c.push(seg(0, 0, 24, 0), seg(24, 0, 24, 14), seg(24, 14, 0, 14), seg(0, 14, 0, 0));
  // freestanding wall (ground floor only)
  c.push(...rect(FREE_WALL.x0 - 0.05, FREE_WALL.z0, FREE_WALL.x1 + 0.05, FREE_WALL.z1, 0));
  // reception desk
  c.push(...rect(DESK.x0, DESK.z0, DESK.x1, DESK.z1, 0));
  // benches & plinths & pots
  for (const b of BENCHES) c.push(...rect(b.x - b.w / 2, b.z - b.d / 2, b.x + b.w / 2, b.z + b.d / 2, 0));
  for (const p of PLINTHS) c.push(...rect(p.x - p.s / 2, p.z - p.s / 2, p.x + p.s / 2, p.z + p.s / 2, 0));
  for (const p of POTS) c.push(...rect(p.x - 0.35, p.z - 0.35, p.x + 0.35, p.z + 0.35, 0));
  // stair balustrade: solid wall from floor to ramp height + rail, all levels
  c.push(seg(STAIR.x0, STAIR.entryZ, STAIR.x0, STAIR_VOID.z1, 'all'));
  // mezzanine railings (level = mezz only, ground floor walks beneath/through)
  const M = ROOM.mezzY;
  c.push(seg(7, 0, 7, 11.2, M));         // west balcony edge
  c.push(seg(17, 0, 17, 11.2, M));       // east balcony edge
  c.push(seg(7, 11.2, 17, 11.2, M));     // bridge north edge
  c.push(seg(22, STAIR_VOID.z0, 22, STAIR_VOID.z1, M));  // stairwell west edge
  c.push(seg(22, STAIR_VOID.z0, 24, STAIR_VOID.z0, M));  // stairwell north edge
  return c;
}
