// ============================================================================
// THE RESIDENCY HANG
//
// Erin Carle's two series, hung in the upper residency halls:
//   fall26  → Rococo Hall  (js/world/rococo.js — 10 gilt frames)
//   spring1 → Nouveau Hall (js/world/nouveau.js — 8 mahogany bays)
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
// per piece, and point `buyUrl` at the work's page on minicuration.com.
// ============================================================================

const ARTIST = 'Erin Carle';
const BUY = 'https://minicuration.com/';

const fall = (id, title, file, px) => ({
  id, title, artist: ARTIST, series: 'fall26',
  year: '', medium: '', price: 'Inquire', buyUrl: BUY,
  image: `assets/art/erin-carle/fall26/${file}`,
  px,
  description: `From Erin Carle's fall26 series, in residence in the Rococo Hall.`,
});

// `extra` carries per-piece exceptions — currently only `wide`, below.
const spring = (id, title, file, px, extra) => ({
  id, title, artist: ARTIST, series: 'spring1',
  year: '', medium: '', price: 'Inquire', buyUrl: BUY,
  image: `assets/art/erin-carle/spring1/${file}`,
  px,
  description: `From Erin Carle's spring1 series, in residence in the Nouveau Hall.`,
  ...extra,
});

// --- Rococo Hall: all ten of fall26 -----------------------------------------
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

// --- Nouveau Hall: seven of spring1 -----------------------------------------
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
// 'Into Bloom' is deliberately NOT hung. The file is still in the folder; leave
// it there and leave it out of this list.
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
