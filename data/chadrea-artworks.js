// ============================================================================
// CHADREA HALL HANG — Chad Rea, "Beautiful Decay", floor 4.
//
// The whole series, twenty works, plus a portrait of the artist. Hung from the
// .webp files in assets/art/chadrea/. Array POSITION is the slot index in
// js/world/chadrea/chadrea.js SLOTS[]; to reshuffle the hang, move entries
// between positions rather than editing coordinates.
//
// `medium` and `dims` are transcribed from the artist's own list
// (assets/art/chadrea/Beautiful Decay Series.pdf) and show on the wall label
// (js/ui/UI.js).
//
// TWO THINGS ABOUT THAT LIST are worth knowing before trusting a number here:
//
//   1. It changes convention halfway. #1–#14 are written HEIGHT × WIDTH, the
//      way the trade writes it; #19–#23 are written width × height. Read
//      literally, #20 would be a landscape and its file is a 2:3 portrait, and
//      the same for #21–#23. Every entry below is normalised to height × width
//      and checked against its file's real aspect, which is why #20 reads
//      60 × 40 here where the list says 40 x 60.
//   2. #15 carries no dimensions at all. It is on birch, made with the same
//      collaborator as #11, and its file has #11's exact aspect, so it is
//      recorded as 36 × 24 — INFERRED, not transcribed. Correct it if the
//      artist says otherwise.
//
// `size` is what actually goes on the wall, in metres. It is the piece's true
// size TIMES `SCALE` below — see the note there, because the label and the wall
// deliberately disagree.
//
// `px` is the source file's TRUE pixel size, which js/art/load.js needs up
// front to decode at the tier's cap instead of at full resolution. Change a
// file and its `px` together, and keep `px`'s aspect equal to `size`'s or the
// picture stretches.
// ============================================================================

import { CHAD_REA_BIO } from './residencies.js';

const ARTIST = 'Chad Rea';
const SERIES = 'Beautiful Decay';

// How much bigger than life the works hang. At 1 the hall shows them at their
// true size — a 48-inch canvas as 1.22 m of concrete — which is honest and, in
// a room with an 8.6 m soffit and 22 m walls, reads as stamps on a lot of grey.
// At 2 the hang fills the architecture.
//
// The consequence, deliberately: `dims` on the label stays the catalogue size,
// because that is a fact about the painting, so the label says 48 × 48 in while
// the thing on the wall measures 2.44 m. Set this to 1 for a true-scale hang.
const SCALE = 2;

// The series statement, shown under every piece in the hall. One text for all
// twenty: the works are a single practice, not twenty separate arguments.
const STATEMENT = 'Paintings over “finished” paintings. A practice of letting go '
  + 'of what felt precious, to make room for what wants to grow next. Like anything '
  + 'that grows in a sidewalk crack only to fade, the work is less concerned with '
  + 'permanence than with the moment. An affirmation that nothing, including the '
  + 'self, is ever really done evolving.';

// The artist's own card, under the statement on every one of his labels. The
// handles are plain text and the sites are links (js/ui/UI.js): the list gives
// a handle without naming a platform, and inventing an instagram.com/... URL
// for it would be putting words in his mouth.
const CONTACT = {
  name: ARTIST,
  role: 'Artist & Cultural Provocateur | Brand Architect | Creative Advisor',
  phone: '(310) 738-8886',
  links: [
    { handle: '@chadrea', url: 'https://www.chadrea.com', label: 'www.chadrea.com' },
    { handle: '@cult.of.happy', url: 'https://www.cultofhappy.com', label: 'www.cultofhappy.com' },
    { handle: '@lockh.arthouse', url: 'https://www.lockharthousetx.com', label: 'www.lockharthousetx.com' },
  ],
};

const IN = 0.0254;
// h, w in inches — normalised height × width — out as the printed label and the
// hanging size [w, h] in metres, the latter carrying SCALE.
const inches = (h, w) => ({
  dims: `${h} × ${w} in`,
  size: [+(w * IN * SCALE).toFixed(3), +(h * IN * SCALE).toFixed(3)],
});

// `n` is the number in the series and the title. `file` is only needed where
// the upload's name does not follow it: #19–#23 carry an 'x' suffix, and #21's
// file has the artist's own spelling of the series in it.
const work = (n, medium, h, w, px, file) => ({
  id: `cr-beautiful-decay-${n}`,
  title: `${SERIES} #${n}`,
  artist: ARTIST,
  series: SERIES,
  year: '',
  medium,
  image: `assets/art/chadrea/${file || `${SERIES} ${n}`}.webp`,
  px,
  description: STATEMENT,
  contact: CONTACT,
  ...inches(h, w),
});

// The artist, on the pier wall by the arch — the first wall on your right as
// you arrive, before the hall opens up. The label under it is his bio, the same
// text the curator speaks downstairs (data/residencies.js), read from there
// rather than copied.
//
// No `size` and no `dims`: a portrait is not one of the works, has no
// catalogued dimensions, and SCALE has nothing to say about it. It contain-fits
// into its slot's envelope the way the other halls size everything.
export const CHAD_PORTRAIT = {
  id: 'cr-portrait',
  title: ARTIST,
  // The name is the title here, so the artist line would print it twice. An
  // empty string is a deliberate blank in js/ui/UI.js — it leaves the line out
  // rather than falling back to the house artist — and `medium` says what the
  // thing on the wall is instead.
  artist: '',
  year: '', medium: 'Portrait of the artist',
  image: 'assets/art/chadrea/chadrea.webp',
  px: [670, 771],
  description: CHAD_REA_BIO,
  contact: CONTACT,
};

// Slot order is the order chadrea.js hangs them — SLOTS[] there says what each
// wall is. Every wall in the residency that will take a picture now carries at
// least one, the courtyard's three included.
//
//   0–1   west wall, the open stretch     the two that survive the reveals and
//                                         the console: the tallest work over the
//                                         console, and a warm one at the arrival
//                                         end where you first meet the concrete
//   2–4   west wall, under the mezzanine  a low-soffit bay, so the run steps
//                                         down to the two smallest in the series
//   5     north wall, over the stair      #10, the strongest graphic, held as
//                                         the terminal view down the hall
//   6     north wall, under the mezzanine
//   7–8   south wall                      the wall you arrive with your back to;
//                                         it used to carry the door out
//   9–10  the mezzanine's two walls       the birch pair, across its corner
//   11–12 the pier's west face            the dark mass the lit wall is read
//                                         against — washed now, so it can hang
//   13–14 the pier's east face            either side of the arch, in the wing
//   15–16 the wing                        its east wall and its north end, the
//                                         brightest light in the residency
//   17–19 the courtyard                   out by the pool, under open sky
//   20    the portrait
export const CHADREA_HANG = [
  /*  0 W over console  */ work(5, 'Spray paint on canvas', 60, 40, [1365, 2048]),
  /*  1 W arrival       */ work(2, 'Spray paint, acrylic, paper, plant-based acid on canvas', 48, 32, [1365, 2048]),
  /*  2 W under mezz    */ work(13, 'Spray paint, acrylic on canvas (framed)', 36, 24, [1365, 2048]),
  /*  3 W under mezz    */ work(3, 'Spray paint, acrylic, plant-based acid on canvas (framed)', 16, 20, [2000, 1600]),
  /*  4 W under mezz    */ work(4, 'Spray paint, acrylic, plant-based acid on canvas', 20, 20, [2000, 2000]),
  /*  5 N over stair    */ work(10, 'Spray paint, acrylic, plastic on canvas', 48, 48, [2000, 2000]),
  /*  6 N under mezz    */ work(11, 'Spray paint, acrylic on birch, with Neal Soley', 36, 24, [1365, 2048]),
  /*  7 S wall          */ work(22, 'Spray paint, acrylic on canvas (framed)', 48, 36, [1503, 2048], 'Beautiful Decay 22x'),
  /*  8 S wall          */ work(23, 'Spray paint, acrylic on canvas (framed)', 48, 36, [1536, 2048], 'Beautiful Decay 23x'),
  /*  9 mezz W          */ work(6, 'Spray paint, acrylic on birch', 36, 24, [1365, 2048]),
  /* 10 mezz N          */ work(7, 'Spray paint, acrylic, pastel on birch', 36, 24, [1365, 2048]),
  /* 11 pier W          */ work(19, 'Spray paint, acrylic on canvas (framed)', 36, 36, [2000, 2000], 'Beautiful Decay 19x'),
  /* 12 pier W          */ work(21, 'Spray paint, acrylic on canvas (framed)', 45, 38, [1762, 2048], 'Beutiful Decay 21x'),
  /* 13 pier E, N of arch */ work(15, 'Spray paint, acrylic on birch, with Neal Soley', 36, 24, [1365, 2048]),
  /* 14 pier E, S of arch */ work(8, 'Spray paint, acrylic, pastel on canvas', 36, 36, [2000, 2000]),
  /* 15 wing E          */ work(1, 'Spray paint, plant-based acid on canvas', 48, 48, [2000, 2000]),
  /* 16 wing N          */ work(9, 'Spray paint, acrylic, plastic on canvas', 48, 32, [1365, 2048]),
  /* 17 courtyard W     */ work(12, 'Spray paint, acrylic, paper on birch', 36, 24, [1365, 2048]),
  /* 18 courtyard E     */ work(14, 'Spray paint, acrylic on canvas (framed)', 36, 24, [1365, 2048]),
  /* 19 courtyard far   */ work(20, 'Spray paint, acrylic on canvas (framed)', 60, 40, [1365, 2048], 'Beautiful Decay 20x'),
  /* 20 the portrait    */ CHAD_PORTRAIT,
];

// Nothing is left in the folder now except the source PDF. #16–#18 are not in
// the artist's list and no files for them were uploaded; if they arrive, add a
// slot to SLOTS[] and a `work(...)` line here at the matching index.
