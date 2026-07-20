import { buildColliders, groundHeight } from './layout.js';
import { PLAYER } from '../config.js';

// Circle-vs-segment sliding collision in the XZ plane, with level-gated
// segments so one XZ line can block the mezzanine but not the floor below.

const SEGMENTS = buildColliders();

export function resolveMovement(pos, dx, dz, walkY) {
  let x = pos.x + dx;
  let z = pos.z + dz;
  const r = PLAYER.radius;

  for (let iter = 0; iter < 3; iter++) {
    for (const s of SEGMENTS) {
      if (s.level !== 'all' && Math.abs(walkY - s.level) > 0.6) continue;
      const ax = s.a[0], az = s.a[1], bx = s.b[0], bz = s.b[1];
      const abx = bx - ax, abz = bz - az;
      const len2 = abx * abx + abz * abz;
      let t = len2 > 0 ? ((x - ax) * abx + (z - az) * abz) / len2 : 0;
      t = Math.max(0, Math.min(1, t));
      const cx = ax + abx * t, cz = az + abz * t;
      let px = x - cx, pz = z - cz;
      const d2 = px * px + pz * pz;
      if (d2 < r * r) {
        const d = Math.sqrt(d2) || 1e-6;
        const push = (r - d) / d;
        x += px * push;
        z += pz * push;
      }
    }
  }
  return { x, z };
}

export function sampleGround(x, z, prevY) {
  return groundHeight(x, z, prevY);
}
