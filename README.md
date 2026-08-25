# iExploreArt — a walkable gallery

iexploreart.com is a first-person 3D art gallery built with [Three.js](https://threejs.org).
Visitors walk through a double-height gallery space, explore original works by
JFeelgood, step out into a walled courtyard with a giant tree, climb to the upper
floor, and speak with Mira, the curator at the reception desk — who can describe
the gallery and point you to the artists in residence upstairs. Nothing is for
sale here: pressing **E** on a painting opens a wall label with its title and
artist, and nothing else.

Beside the reception desk a lift rides up to the **artist residencies** — six
further rooms, listed in `data/residencies.js`: an arcaded courtyard palazzo on
floor 1, an Art Nouveau domed hall on 2, a Rococo gallery on 3, a concrete house
of one long top-lit hall, a daylit wing and a walled pool courtyard on 4, a whole
glazed floor plate over the city with a French parterre round the lift core and
an infinity pool off its west edge on 5, and a board-formed concrete hall built
round a four-storey void on 6.

An entry may carry `pending: true`, which means the floor is spoken for but the
room is not built: the lift leaves it off the panel rather than offering a
button that arrives nowhere. Nothing is pending right now.

An entry may also carry `closed: true` — built, but shut to visitors. The lift
won't stop there, while the curator still lists it, marked closed, so a visitor
asking after it gets an answer. **Brutalism Hall (floor 6) is closed.** Delete
the flag in `data/residencies.js` to reopen it.

Everything is static files — no build step, no server. Open `index.html` from any
static host (GitHub Pages, Netlify, etc.).

## Controls

| Desktop | Mobile |
|---|---|
| **W A S D** / arrows — walk | left thumb — virtual joystick |
| mouse — look (click to capture) | right thumb — drag to look |
| **E** — view painting / talk to curator | tap — view / talk |
| **Shift** — walk faster · **Esc** — pause | |

## The artwork

The walls hold JFeelgood's real work — 17 pieces, stored as `.webp` in
**`assets/art/`** and hung via **`data/artworks.js`**. Each `size` is set to the
photo's true aspect ratio so nothing is stretched. `year`, `medium`, and
`description` are editable placeholders you can fill in per piece, though the
info panel shows only `title` and the artist (`js/ui/UI.js`).

To add or swap a piece:

1. Drop your `.webp` (or `.jpg`/`.png`) file into **`assets/art/`**.
2. Open **`data/artworks.js`** and set `image: "assets/art/your-file.webp"` on
   the matching entry. While `image` is `null` a placeholder is generated.
3. Update `title` and `description`.

The artwork keeps its manifest width; height adapts to the photo's aspect ratio
automatically. Slot positions (`G-…` ground floor, `M-…` mezzanine, `C-…`
courtyard wall) are defined in `js/world/layout.js`.

### The residency halls

The upper residencies hang visiting artists from their own manifests. Erin Carle
holds two of them, from **`data/residency-artworks.js`** — the ten works of her
*Fall Series* across the Rococo Hall, seven of the *Spring Series* in the
Nouveau Hall; the asset folders keep their original `fall26` / `spring1` names.
Her name is what the info panel prints under each title — a work's own `artist`
wins over the house artist, and an empty `artist` prints nothing at all.

Brutalism Hall on floor 6 hangs uncredited from
**`data/brutalist-artworks.js`** — ten works, all still `image: null`, so
`js/art/placeholder.js` generates a canvas for each and the hall reads as
complete until the real files arrive. The hall is closed to visitors, so the
lift does not stop there.

Chad Rea holds **Chadrea Hall** on floor 4
(`js/world/chadrea/chadrea.js`) — a concrete house rather than a gallery: one
long board-formed hall under an 8.6 m soffit, a mezzanine reached by a single
cantilevered flight, and a rounded plaster arch through the pier wall into a
white, daylit wing that opens again onto a walled courtyard with a reflecting
pool, the city standing over its far wall and the lift shaft running straight
up the wing's face between the two openings. Its ten works are **decoration** — generated canvases hung
flat on the concrete, with no manifest and no `userData.artwork`, so nothing
there answers an **E** press. To hang real pieces it needs a
`data/chadrea-artworks.js` and an exported `SLOTS[]`, the way Brutalism Hall
does it; the hang loop in `brutalism/brutalist.js` is the pattern to copy.

Maria Decetise holds **Decetise Hall** on floor 5 (`js/world/decetise.js`) —
one whole floor plate of a high rise, glazed the length of its north and east
sides. The west has no wall at all: the room opens straight onto an infinity
pool that fills the terrace edge to edge and spills off the lip of the slab,
five storeys up. Nothing is out there to stand on — the coping is the
threshold, and the next step is a metre of water. The lift core stands in the
middle of the plate rather than against a wall, in a French parterre: gravel, a
balustraded stone kerb, clipped hedges, a basin, park chairs, and five plane
trees growing up through oculi cut in the ceiling, and four more out on the
terrace at the ends of the water. Its nine works hang from `DECETISE_HANG`, a
manifest exported by the room's own file alongside `SLOTS[]` — six on the south
art wall and three on the faces of the core itself, which are what you see as
the doors open. Every entry is still `image: null`, so each slot carries a
generated placeholder; unlike Chadrea Hall's, these do answer an **E** press,
with the title and the resident's name. There is no return door on a wall: the
way out is the cabin you arrived in — look back at its brass wall and press **E**.

It works differently from `data/artworks.js`, because these frames are carved
geometry rather than four flat bars. Array position is the slot index in that
hall (a `null` leaves the frame's generated placeholder), and each entry carries
`px` — the source file's true pixel size — rather than a size in metres. Each
hall declares an envelope per wall, the largest picture that wall can take, and
`fitToSlot()` in `js/art/fit.js` fits the photograph inside it. So the moulding
is cut to the picture instead of the picture being stretched to the moulding,
and no two frames in a hall need to match. **Change a file and its `px`
together** — that pair is what keeps frame and canvas agreeing.

To hang something else, edit the array and drop the `.webp` into
`assets/art/<artist>/<series>/` (`cwebp -q 90 -noalpha -metadata none in.png -o
out.webp` matches how the rest were encoded). Filenames may contain spaces;
they're `encodeURI`'d at load.

Not everything hangs. *Into Bloom* lies flat on a slowly turning stone table in
the middle of the Rococo Hall — `INTO_BLOOM` in the same file, built by
**`js/world/rococo-plinth.js`**. Its panel is an extrusion of the artwork's
outline; give that entry an `outline` (normalised points, like `outline` in
`data/artworks.js`) and the table is cut to that silhouette instead of the
photograph's own rectangle.

One Nouveau entry carries `wide: true`. A landscape work in a standard bay fits
to something much shorter than its neighbours, so a wide bay gives up its two
marquetry inlay strips and lets the frame span the bay instead. It's marked per
piece rather than inferred from aspect, so the room's rhythm only changes when
someone means it to.

The curator's conversation lives in **`data/dialogue.js`** — plain data, easy to
edit. Who is in residence where lives in **`data/residencies.js`**; the curator
and the reception lift both read it.

## Project layout

```
index.html            entry + UI overlays (import map, no bundler)
css/gallery.css       brand-styled UI
data/artworks.js      ← the collection manifest you edit
data/residency-artworks.js  ← what hangs in the Nouveau and Rococo halls
data/brutalist-artworks.js  ← what hangs in Brutalism Hall
data/dialogue.js      ← the curator's conversation tree
data/residencies.js   ← the artist residencies the reception lift serves
js/
  main.js             bootstrap, room registry wiring + frame loop
  RoomManager.js      room switching: visibility, colliders, targets, spawn
  world/layout.js     floor plan: dimensions, painting slots, colliders, stairs
  world/Gallery.js    the building (merged geometry)
  world/CityView.js   procedural 3D city + sky outside the north window
  world/Courtyard.js  the open-air room: tree, flowers, display wall
  world/ReceptionLift.js  the lift by the front desk — the hub for room travel
  world/CourtyardRoom.js  residency: arcaded palazzo around a garden
  world/nouveau.js        residency: domed hall in leaded glass (built on first visit)
  world/rococo.js         residency: gilt hall under a painted ceiling (ditto)
  world/rococo-plinth.js  the turning table at the centre of that hall
  world/brutalism/brutalist.js  residency: board-formed concrete round a
                          four-storey void, glass floor at the top, infinity
                          pool over the city (ditto)
  world/chadrea/chadrea.js  residency: top-lit concrete hall, mezzanine on a
                          cantilevered flight, arch through to a daylit wing,
                          walled pool courtyard beyond it (ditto)
  world/decetise.js       residency: one glazed floor plate over the city, the
                          lift core standing in a gravel parterre with plane
                          trees through the ceiling, infinity pool west (ditto)

  world/Lighting.js   sun, spots, baked shadows
  art/                frames, placards, placeholder painting generator,
                      aspect-fitting (fit.js) + photo loading (load.js)
  curator/Curator.js  portrait billboard, idle animation, dialogue runner
  ui/, controls/      overlays, pointer-lock + touch input
vendor/three/         vendored Three.js (r0.185) + addons subset
assets/               textures (MIT, from the three.js repo), HDR environment
```

## Credits

- Three.js and example textures/HDR © Three.js authors, MIT license
  (`vendor/three/LICENSE`).
- All artwork, writing, and design © JFeelgood / iExploreArt.
