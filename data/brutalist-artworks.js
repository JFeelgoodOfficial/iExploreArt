// ============================================================================
// BRUTALISM HALL HANG — ten works, floor 4.
//
// Placeholders. Every entry has `image: null`, so js/art/placeholder.js
// generates an abstract canvas in the house palette and the hall reads as
// complete before real files arrive. To hang a photograph:
//
//   1. drop the .webp into assets/art/<artist>/<series>/
//   2. set `image` to that path and `px` to the file's TRUE pixel size
//   3. fill in title / year / medium / description
//
// Array POSITION is the slot index in js/world/brutalism/brutalist.js SLOTS[]. `px` is
// what fitToSlot() contain-fits into each slot's envelope, so the canvas is cut
// to the picture rather than the picture stretched to the wall. Change a file
// and its `px` together.
//
// `palette` picks the placeholder's colourway (teal | terracotta | ink | mixed)
// and is ignored once `image` is set.
// ============================================================================

const ARTIST = 'Chad Rea';
const SERIES = 'Brutalism Hall';

const work = (id, title, px, palette, extra) => ({
  id, title, artist: ARTIST, series: SERIES,
  year: '', medium: '', price: 'Inquire',
  image: null,
  px,
  palette,
  description: 'Placeholder — in residence in Brutalism Hall.',
  ...extra,
});

// Slot order is the order brutalism/brutalist.js hangs them: two on the end wall you
// meet on arrival, two on the freestanding fin, then one pair per gallery
// level as you climb — level 1, level 2, and two on the glass floor at level 3.
export const BRUTALIST_HANG = [
  /* 0 end wall  */ work('bx-01', 'Untitled I', [2048, 1420], 'ink'),
  /* 1 end wall  */ work('bx-02', 'Untitled II', [2048, 1690], 'mixed'),
  /* 2 fin south */ work('bx-03', 'Untitled III', [1500, 2048], 'teal'),
  /* 3 fin north */ work('bx-04', 'Untitled IV', [1660, 2048], 'terracotta'),
  /* 4 level 1 W */ work('bx-05', 'Untitled V', [1580, 2048], 'ink'),
  /* 5 level 1 S */ work('bx-06', 'Untitled VI', [2048, 1560], 'mixed'),
  /* 6 level 2 W */ work('bx-07', 'Untitled VII', [1480, 2048], 'teal'),
  /* 7 level 2 S */ work('bx-08', 'Untitled VIII', [2048, 1620], 'terracotta'),
  /* 8 level 3 N */ work('bx-09', 'Untitled IX', [1600, 2048], 'ink'),
  /* 9 level 3 E */ work('bx-10', 'Untitled X', [2048, 1360], 'mixed'),
];
