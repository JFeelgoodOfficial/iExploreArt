# iExploreArt — a walkable gallery

iexploreart.com is a first-person 3D art gallery built with [Three.js](https://threejs.org).
Visitors walk through a double-height gallery space, explore original works by
JFeelgood, step out into a walled courtyard with a giant tree, climb to the upper
floor, and speak with Mira, the curator at the reception desk — who can tell the
story behind every piece and route purchases through
[minicuration.com](https://minicuration.com).

Everything is static files — no build step, no server. Open `index.html` from any
static host (GitHub Pages, Netlify, etc.).

## Controls

| Desktop | Mobile |
|---|---|
| **W A S D** / arrows — walk | left thumb — virtual joystick |
| mouse — look (click to capture) | right thumb — drag to look |
| **E** — view painting / talk to curator | tap — view / talk |
| **Shift** — walk faster · **Esc** — pause | |

## Adding your real artwork photos

The paintings currently on the walls are generated placeholders. To hang real
work:

1. Drop your `.webp` (or `.jpg`/`.png`) files into **`assets/art/`**.
2. Open **`data/artworks.js`** and, for each piece, set
   `image: "assets/art/your-file.webp"` on the matching entry.
   While `image` is `null` a placeholder is generated.
3. Update `title`, `description`, `price`, and — importantly — `buyUrl` to the
   piece's page on minicuration.com.

The artwork keeps its manifest width; height adapts to the photo's aspect ratio
automatically. Slot positions (`G-…` ground floor, `M-…` mezzanine, `C-…`
courtyard wall) are defined in `js/world/layout.js`.

The curator's conversation lives in **`data/dialogue.js`** — plain data, easy to
edit.

## Project layout

```
index.html            entry + UI overlays (import map, no bundler)
css/gallery.css       brand-styled UI
data/artworks.js      ← the collection manifest you edit
data/dialogue.js      ← the curator's conversation tree
js/
  main.js             bootstrap + frame loop
  world/layout.js     floor plan: dimensions, painting slots, colliders, stairs
  world/Gallery.js    the building (merged geometry)
  world/CityView.js   procedural 3D city + sky outside the north window
  world/Courtyard.js  the open-air room: tree, flowers, display wall
  world/Lighting.js   sun, spots, baked shadows
  art/                frames, placards, placeholder painting generator
  curator/Curator.js  figure, idle animation, dialogue runner
  ui/, controls/      overlays, pointer-lock + touch input
vendor/three/         vendored Three.js (r0.185) + addons subset
assets/               textures (MIT, from the three.js repo), HDR environment
```

## Credits

- Three.js and example textures/HDR © Three.js authors, MIT license
  (`vendor/three/LICENSE`).
- All artwork, writing, and design © JFeelgood / iExploreArt.
