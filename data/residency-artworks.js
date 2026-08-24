// ============================================================================
// THE RESIDENCY HANG
//
// Erin Carle's two series, hung in the upper residency halls:
//   Fall Series   → Rococo Hall  (js/world/rococo.js — 10 gilt frames)
//   Spring Series → Nouveau Hall (js/world/nouveau.js — 8 mahogany bays)
//
// The series NAMES below are display text — they show in the info panel's meta
// line (js/ui/UI.js) and in the curator's blurbs (data/residencies.js). The
// asset folders keep their original `fall26` / `spring1` spelling; renaming the
// label is not a reason to move the files.
//
// Array POSITION is the slot index in that hall's `slots[]`. A null entry
// leaves the frame's generated placeholder canvas alone.
//
// `px` is the source file's TRUE pixel size. It is not decoration: each hall
// declares a per-wall envelope (maxW × maxH in metres) and contain-fits `px`
// into it via fitToSlot() in js/art/fit.js, BEFORE the frame moulding is
// extruded. That is what keeps every picture at its own aspect ratio — the
// frame is cut to the picture, never the other way round. Change a file and
// its `px` together, or the frame and the canvas will disagree.
//
// `title` follows each uploaded file name verbatim, spelling and all.
// `year` / `medium` / `description` are editable placeholders — fill them in
// per piece. Nothing here is for sale: the info panel is a wall label, showing
// whatever of title / artist / year / medium / dims / series / description the
// entry carries and hiding the lines it doesn't (js/ui/UI.js).
// ============================================================================

const ARTIST = 'Erin Carle';
const FALL = 'Fall Series';
const SPRING = 'Spring Series';

// Shown under the statement on every one of her labels (js/ui/UI.js). Same
// shape as Chad Rea's card in data/chadrea-artworks.js, which carries a name, a
// role and a phone number as well — every field is optional, and hers is the
// portfolio alone.
const CONTACT = {
  links: [
    { url: 'https://erincarleart.myportfolio.com/', label: 'erincarleart.myportfolio.com' },
  ],
};

const fall = (id, title, file, px) => ({
  id, title, artist: ARTIST, series: FALL,
  year: '', medium: '',
  image: `assets/art/erin-carle/fall26/${file}`,
  px,
  description: `From Erin Carle's ${FALL}, in residence in the Rococo Hall.`,
  contact: CONTACT,
});

// `extra` carries per-piece exceptions — currently `wide` and `outline`, below.
const spring = (id, title, file, px, extra) => ({
  id, title, artist: ARTIST, series: SPRING,
  year: '', medium: '',
  image: `assets/art/erin-carle/spring1/${file}`,
  px,
  description: `From Erin Carle's ${SPRING}, in residence in the Nouveau Hall.`,
  contact: CONTACT,
  ...extra,
});

// --- Rococo Hall: all ten of the Fall Series --------------------------------
// Slot order is the order rococo.js hangs them: west wall lower (z −1.775 then
// +1.775), west upper, east lower, east upper, then the two end-wall slots.
//
// The hang follows the room. The end wall is the widest surface in the hall and
// the one you face when you arrive, so the two landscape works take it and fill
// it. The four widest works overall land in the four widest slots. The two
// Normal Rhythm pieces stay a pair, side by side at eye level on the west wall,
// and everything left is a portrait — which means all four upper-gallery frames
// come out height-bound at exactly 2.05 m, reading as one band that varies only
// in width. Note the upper register is out of reach from the floor
// (PLAYER.interactDistance is 3.6 m); those four are inspected from the gallery
// deck, which is what the hall's own lift is for.
export const ROCOCO_HANG = [
  /* 0 W lower */ fall('ec-normal-rhythm-2', 'Normal Rhythm 2', 'Normal Rhythm 2.webp', [2009, 2048]),
  /* 1 W lower */ fall('ec-normal-rhythm-1', 'Normal Rhythm 1', 'Normal Rhythm 1.webp', [1576, 2048]),
  /* 2 W upper */ fall('ec-two-for-one', 'Two for One', 'Two for One.webp', [1626, 2048]),
  /* 3 W upper */ fall('ec-self-portait', 'Self Portait', 'Self Portait.webp', [1498, 2048]),
  /* 4 E lower */ fall('ec-you-should-eat-a-burger', 'You Should Eat a Burger', 'You Should Eat a Burger.webp', [2048, 2044]),
  /* 5 E lower */ fall('ec-ash-tray', 'Ash Tray', 'Ash Tray.webp', [1638, 2048]),
  /* 6 E upper */ fall('ec-for-consumption', 'For Consumption', 'For Consumption.webp', [1521, 2048]),
  /* 7 E upper */ fall('ec-stale', 'Stale', 'Stale.webp', [1365, 2048]),
  /* 8 end wall */ fall('ec-stills', 'Stills from 2 video projects 2', 'Stills from 2 video projects 2.webp', [2048, 1330]),
  /* 9 end wall */ fall('ec-american-layers', 'American Layers', 'American Layers.webp', [2048, 1755]),
];

// --- Nouveau Hall: seven of the Spring Series -------------------------------
// Eight bays, seven works, so exactly one keeps its generated canvas: bay 1,
// immediately right of the portal, where a gap reads least. The works then run
// unbroken from bay 2 all the way round to bay 8.
//
// Bays 4 and 5 straddle the entry axis, so they carry the two pieces you meet
// head-on. Heights run 2.10 → 1.68 → 1.70 → 1.24 → 1.90 → 2.10 → 2.10 across
// the arc: full-height portraits at either end, stepping down to the broad, low
// 'Dance of the Willis 3' in the middle.
//
// `wide: true` is a curatorial exception, not something to infer from aspect —
// it costs that bay its two marquetry inlay strips so a landscape work can span
// the whole bay (see PICT_WIDE in js/world/nouveau.js). At 16:9 'Dance of the
// Willis 3' would otherwise fit to 1.66 × 0.93 and read as a letterbox floating
// in a 3.2 m mahogany field.
//
// 'Into Bloom' is deliberately NOT on this wall — it is shown flat, on the
// turning table in the middle of the Rococo Hall. See INTO_BLOOM below. Leave
// it out of this list.
export const NOUVEAU_HANG = [
  /* 0 bay 1 */ null,
  /* 1 bay 2 */ spring('ec-i-saw-this', 'I Saw This', 'I Saw This.webp', [1557, 1975]),
  /* 2 bay 3 */ spring('ec-in-a-dream', 'In a Dream', 'In a Dream.webp', [1476, 1493]),
  /* 3 bay 4 */ spring('ec-autonomy-1', 'Autonomy 1', 'Autonomy 1.webp', [1146, 1174]),
  /* 4 bay 5 */ spring('ec-dance-of-the-willis-3', 'Dance of the Willis 3', 'Dance of the Willis 3.webp', [2048, 1152], { wide: true }),
  /* 5 bay 6 */ spring('ec-morphogenesis', 'Morphogenesis', 'Morphogenesis.webp', [1792, 2048]),
  /* 6 bay 7 */ spring('ec-as-the-world-was-falling-apart', 'As the World was Falling Apart', 'As the World was Falling Apart.webp', [1618, 2048]),
  /* 7 bay 8 */ spring('ec-when-i-was-young', 'When I was Young', 'When I was Young.webp', [1566, 2024]),
];

// --- Rococo Hall, the table -------------------------------------------------
// Not a wall slot. 'Into Bloom' lies flat on the turning table in the middle of
// the hall (js/world/rococo-plinth.js), so you walk round it rather than stand
// in front of it.
//
// The work itself is a round shaped panel, but the source file is a rectangular
// photograph of it on a white ground and carries no alpha. Without an `outline`
// the extrusion takes the photograph's edges and the white ground becomes table
// top. So the silhouette is given explicitly: normalised [x, y] fractions of the
// source image, x right and y DOWN, same convention as `outline` in
// data/artworks.js. The panel is cut to this, and it is what the table is sized
// from — see PLINTH.diameter in js/world/rococo-plinth.js.
//
// Traced from the file at 48 even angles about the painted centre (0.5006,
// 0.4998), stopping at the last painted pixel and stepping 3 px back inside it
// so no white fringe survives the cut. The panel is a hand-cut round, not a
// machined disc: radii run 681–763 px, up to 2.7% off a true ellipse, and the
// trace keeps that. Re-trace if the file is ever replaced.
const INTO_BLOOM_OUTLINE = [
  [0.9807, 0.4998], [0.9785, 0.5484], [0.9662, 0.5962], [0.9442, 0.6417],
  [0.9164, 0.6853], [0.8765, 0.7227], [0.8308, 0.7549], [0.7790, 0.7802],
  [0.7280, 0.8042], [0.6711, 0.8178], [0.6151, 0.8299], [0.5574, 0.8333],
  [0.5006, 0.8323], [0.4444, 0.8299], [0.3888, 0.8224], [0.3328, 0.8128],
  [0.2805, 0.7945], [0.2280, 0.7744], [0.1799, 0.7477], [0.1368, 0.7156],
  [0.0980, 0.6794], [0.0653, 0.6392], [0.0418, 0.5948], [0.0246, 0.5482],
  [0.0199, 0.4998], [0.0227, 0.4511], [0.0357, 0.4035], [0.0571, 0.3578],
  [0.0876, 0.3154], [0.1268, 0.2780], [0.1710, 0.2450], [0.2207, 0.2177],
  [0.2738, 0.1961], [0.3292, 0.1799], [0.3858, 0.1687], [0.4438, 0.1662],
  [0.5006, 0.1658], [0.5572, 0.1677], [0.6131, 0.1752], [0.6675, 0.1885],
  [0.7202, 0.2059], [0.7710, 0.2274], [0.8160, 0.2560], [0.8620, 0.2854],
  [0.8984, 0.3223], [0.9325, 0.3615], [0.9552, 0.4056], [0.9741, 0.4516],
];

export const INTO_BLOOM = spring(
  'ec-into-bloom', 'Into Bloom', 'Into Bloom.webp', [1583, 2048],
  {
    outline: INTO_BLOOM_OUTLINE,
    description: `From Erin Carle's ${SPRING}, laid flat on the table at the centre of the Rococo Hall.`,
  },
);
