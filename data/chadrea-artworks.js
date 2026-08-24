// ============================================================================
// CHADREA HALL HANG — Chad Rea, "Beautiful Decay", floor 4.
//
// Ten of the series, hung from the .webp files in assets/art/chadrea/. The
// artist supplied twenty-three works; the hall has ten walls that will take a
// picture, so #1–#10 are up and the rest wait in the folder. To reshuffle the
// hang, move entries between array positions — POSITION is the slot index in
// js/world/chadrea/chadrea.js SLOTS[].
//
// `medium` and `dims` are transcribed from the artist's own list
// (assets/art/chadrea/Beautiful Decay Series.pdf) and show on the wall label
// (js/ui/UI.js). `dims` follows the list's convention — HEIGHT × WIDTH, the way
// the trade writes it — which is why `inches(h, w)` below takes them that way
// round and `size` comes back out as [width, height] in metres.
//
// `size` is the piece's TRUE physical size. Unlike the other residency halls,
// which contain-fit each picture into whatever envelope its wall declares, this
// hall hangs at real scale: a 48-inch canvas is 1.22 m of concrete, and a
// 20-inch one is 0.51 m, so the hang has the rhythm the artist's own studio
// wall would. `maxW`/`maxH` on each slot survive as a guard — a work larger
// than its wall is scaled down to fit, never up (see sizeFor in chadrea.js).
//
// `px` is the source file's TRUE pixel size, which js/art/load.js needs up
// front to decode at the tier's cap instead of at full resolution. Every file
// was written out at the house's 2048 px long edge. Change a file and its `px`
// together, and keep `px`'s aspect equal to `size`'s or the picture stretches.
// ============================================================================

const ARTIST = 'Chad Rea';
const SERIES = 'Beautiful Decay';

// The series statement, shown under every piece in the hall. One text for all
// ten: the works are a single practice, not ten separate arguments.
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
// h, w in inches — the artist's order — out as the label text and [w, h] metres.
const inches = (h, w) => ({
  dims: `${h} × ${w} in`,
  size: [+(w * IN).toFixed(3), +(h * IN).toFixed(3)],
});

// `n` is the number in the series, which is also the file name and the title.
const work = (n, medium, h, w, px) => ({
  id: `cr-beautiful-decay-${n}`,
  title: `${SERIES} #${n}`,
  artist: ARTIST,
  series: SERIES,
  year: '',
  medium,
  image: `assets/art/chadrea/${SERIES} ${n}.webp`,
  px,
  description: STATEMENT,
  contact: CONTACT,
  ...inches(h, w),
});

// Slot order is the order chadrea.js hangs them — see SLOTS[] there for what
// each wall is. The short version, and why each piece is where it is:
//
//   0  west wall, over the console      #5   the tallest work, standing over
//                                            the long horizontal of the console
//   1  west wall, by the arrival end    #2   warm and legible, the first thing
//                                            you meet on the grey concrete
//   2  west wall, under the mezzanine   #3   the two smallest works, in the one
//   3  west wall, under the mezzanine   #4   low-soffit bay in the hall
//   4  north wall, over the stair       #10  the strongest graphic in the
//                                            series, held as the terminal view
//                                            down the length of the hall
//   5  wing, west side, past the arch  #8
//   6  mezzanine, west wall             #6   the two birch panels, same size,
//   7  mezzanine, north wall            #7   paired across the deck's corner
//   8  wing, east wall                  #1   the principal wall of the daylit
//                                            room — the coolest work, in the
//                                            brightest light in the residency
//   9  wing, north wall                 #9
export const CHADREA_HANG = [
  /* 0 W over console */ work(5, 'Spray paint on canvas', 60, 40, [1365, 2048]),
  /* 1 W arrival      */ work(2, 'Spray paint, acrylic, paper, plant-based acid on canvas', 48, 32, [1365, 2048]),
  /* 2 W under mezz   */ work(3, 'Spray paint, acrylic, plant-based acid on canvas (framed)', 16, 20, [2000, 1600]),
  /* 3 W under mezz   */ work(4, 'Spray paint, acrylic, plant-based acid on canvas', 20, 20, [2000, 2000]),
  /* 4 N over stair   */ work(10, 'Spray paint, acrylic, plastic on canvas', 48, 48, [2000, 2000]),
  /* 5 wing W, S of arch */ work(8, 'Spray paint, acrylic, pastel on canvas', 36, 36, [2000, 2000]),
  /* 6 mezz W         */ work(6, 'Spray paint, acrylic on birch', 36, 24, [1365, 2048]),
  /* 7 mezz N         */ work(7, 'Spray paint, acrylic, pastel on birch', 36, 24, [1365, 2048]),
  /* 8 wing E         */ work(1, 'Spray paint, plant-based acid on canvas', 48, 48, [2000, 2000]),
  /* 9 wing N         */ work(9, 'Spray paint, acrylic, plastic on canvas', 48, 32, [1365, 2048]),
];

// The remaining works sit unhung in assets/art/chadrea/, converted and ready:
// #11–#15 and #19–#23. (#11 and #15 were made with Neal Soley; #16–#18 are not
// in the artist's list.) Give the hall more walls and they can go up — add a
// slot to SLOTS[] and a `work(...)` line here at the matching index.
