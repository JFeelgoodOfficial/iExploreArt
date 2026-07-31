# The Cast Hall — dropping it into iExploreArt

Three new/edited files. Everything else is untouched.

```
js/world/brutalist.js          new — the room
data/brutalist-artworks.js     new — the ten placeholder works
data/residencies.js            edited — fourth lift destination (floor 4)
js/main.js                     edit below — one import pair + one room factory
```

## 1. `js/main.js` — imports

Beside the other room imports:

```js
import {
  buildBrutalistRoom, setupBrutalistLighting,
  brutalistGround, brutalistSegments, SPAWN as BX_SPAWN, BX, SUN_POS,
} from './world/brutalist.js';
import { BRUTALIST_HANG } from '../data/brutalist-artworks.js';
```

`buildCityView` is already imported in `main.js` — the factory below reuses it.

## 2. `js/main.js` — the factory

Add to `ROOM_FACTORIES`, after `rococo`. Built on first visit behind the lift's
veil, same as the other two; the lighting rig is created inside the factory so
`captureLayer` hides it with the room.

```js
  brutalist: () => {
    const room = buildBrutalistRoom(scene, { tier, ...artOpts, art: BRUTALIST_HANG });
    const lights = setupBrutalistLighting(scene, renderer, tier);
    // The city the pool looks over. Same builder as the gallery's north view,
    // yawed a quarter turn the other way so the skyline lies out along +X, past
    // the terrace's infinity edge. `fog` is global and the gallery already set
    // it; the sun matches setupBrutalistLighting's SUN_POS.
    const city = buildCityView(scene, renderer, {
      name: 'city-cast-hall', seed: 5150, yaw: -Math.PI / 2, fog: false,
      sunPosition: SUN_POS, nearProps: tier.name !== 'low',
    });
    // south wall by the spawn, facing back up the hall
    const door = returnDoor(2.6, 1.35, BX.z1 - 0.14, Math.PI);
    return {
      room: { ...room, lights, city },
      def: {
        targets: [door, ...room.interactables],
        spawn: BX_SPAWN,
        segments: brutalistSegments(),
        ground: brutalistGround,
        background: new THREE.Color(0x9aa3a8),
        bake: () => { lights.bake(); },
      },
    };
  },
```

And in the frame loop, beside the other city ticks:

```js
  if (rooms.current === 'brutalist') {
    residencyRooms.brutalist?.city.update(t);
    residencyRooms.brutalist?.update(dt);      // the pool's ripple normals
  }
```

Nothing else is needed: `RESIDENCIES` now carries the `brutalist` id, so the
reception lift lists it, `lift.onArrive` builds it through `ensureRoom`, and the
curator reads its blurb from the same array.

## The room in one paragraph

26 × 34 m, **four storeys** — 17.6 m to the underside of a waffle slab. Every
large surface carries its own non-repeating board-formed texture drawn at true
scale (220 mm boards, butt joints, tie holes on a 900 × 660 grid, pour blotches
and rain streaks), so nothing tiles. Levels 1 and 2 are rings round a single
void with cast upstands on every open edge; **level 3 is a glass floor** over
the whole void on a 2.5 m steel bearer grid — you stand on it under the
skylight slot and look 13 m down.

The climb is three cantilevered flights, each against a different wall, so
getting to the top walks you round the void: ground → 1 on the **west** wall,
1 → 2 on the **north**, 2 → 3 on the **east**. Each comes up through a hole in
the plate above it.

The level-1 east wall is missing over its northern half: the hall walks out onto
a terrace on a podium, blade wall north, and an infinity pool whose far lip is
the building edge, with the city under it. **The pool starts inside** — it is
cut into the level-1 plate at x 9.6, passes out through the wall line, and only
then goes over the edge; its tank hangs below the plate into the ground-floor
storey. Blue tiled tank, and the water is `MeshPhysicalMaterial` — transmission,
attenuation, clearcoat, and two ripple normal maps crossing each other, scrolled
by `room.update(dt)`.

Ten works, unframed, 18 mm off the concrete on a shadow gap: two on the arrival
end wall, two on the fin, two on level 1, two on level 2, two on level 3. Every
one sits ~2.1 m above the plate it is read from, inside
`PLAYER.interactDistance`.

Ten works, unframed, standing 18 mm off the concrete on a shadow gap: four on
the west wall (one per deck level, plus a pair at arrival), three on the east,
two on the freestanding fin on deck B, one large on the end wall you meet as
you walk in. Every one is inside `PLAYER.interactDistance` of the deck it is
read from. Colour appears twice — a terracotta and an olive seating pod on the
arrival deck — and nowhere else.

## Editing the hang

`data/brutalist-artworks.js`, array position = slot index in `SLOTS`. Set
`image` to the `.webp` path and `px` to its true pixel size; `fitToSlot()` cuts
the canvas to the picture inside that slot's envelope. While `image` is `null`
a placeholder canvas is generated in the `palette` named on the entry.

## Preview

`preview-cast-hall.html` in this project walks the room standalone (WASD +
drag to look, and six preset viewpoints). It uses the vendored Three.js and the
same `brutalist.js` — it is not part of the repo drop.
