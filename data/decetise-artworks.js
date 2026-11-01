// Maria Decetise — Decetise Hall (js/world/decetise.js), floor 5.
//
// Same shape as data/chadrea-artworks.js: the hang in slot order, the show
// card the foyer's title wall opens, and the contact block every label carries
// behind its enquiry button. Kept out of the room's own file so the foyer and
// the curator can read it without pulling in the room's geometry.
//
// Not every piece came with a size, so each hangs at its photograph's aspect,
// fitted into a common box (decetise.js), rather than at true size.

import { MARIA_DECETISE_BIO } from './residencies.js';

const ARTIST = 'Maria Decetise';
const HALL = 'Decetise Hall';

const CONTACT = {
  name: ARTIST,
  links: [
    { handle: '@mdecetiseart', url: 'https://www.instagram.com/mdecetiseart', label: 'instagram.com/mdecetiseart' },
  ],
};

// `label` carries what she has published for a piece: title, year, medium,
// size as she writes it, her own description, and `sold`. A piece without one
// hangs as "Untitled" with the house line.
const work = (n, px, label = {}) => ({
  id: `md-${n}`,
  title: 'Untitled', artist: ARTIST,
  year: '', medium: '',
  image: `assets/art/decetise/Decetise ${n}.webp`,
  px,
  description: `By ${ARTIST}, in residence in ${HALL}.`,
  contact: CONTACT,
  ...label,
});

// Slot order is SLOTS[] in js/world/decetise.js: the south art wall west to
// east (DX-A1…A6), then the north wall (DX-B1…B5), then the face of the lift
// core (DX-C1). Six hang on the south wall, the one a visitor faces stepping
// out of the lift. The square and the portrait take the two ends; the four
// landscapes run between them, the two quiet interiors alternating with the
// pulp-cover pieces. The seventh hangs on the lift core's west face, beside
// the cabin doors. The north wall's five slots stay empty (decetise.js skips
// a null entry).
//
// Titles and descriptions are hers, word for word. Sizes are as she gives
// them (width first for the landscapes); three pieces came without one.
export const DECETISE_HANG = [
  /* DX-A1 */ work(1, [1284, 1278], {
    title: 'Faster Than Fear', medium: 'Oil paint',
    description: 'A woman races ahead of a seemingly murderous beast, yet her smirk '
      + 'suggests confidence rather than fear. The playful scene transforms danger into '
      + 'a game, reflecting the challenges we encounter in everyday life. Although we '
      + 'cannot always control what pursues us, we can choose how we face it, and '
      + 'whether we allow fear to define the experience.',
  }),
  /* DX-A2 */ work(2, [1284, 1021]),   // the panther riders: no title yet
  /* DX-A3 */ work(3, [1165, 875], {
    title: 'Dark Eyed Sailor', year: '2026', medium: 'Oil paint', dims: '24 × 18 in',
    description: 'The two women share a familiar space but seem emotionally removed '
      + 'from one another, each absorbed in a different reality. The strange imagery '
      + 'behind them gives form to the private turbulence that follows a loss of '
      + 'connection. The painting explores how isolation can alter our experience of '
      + 'belonging, turning a once-comforting home into something distant and '
      + 'unfamiliar.',
  }),
  /* DX-A4 */ work(4, [1600, 1149], {
    title: 'Dino Dreams', medium: 'Oil paint',
    description: 'This painting imagines a dreamlike encounter between a woman and two '
      + 'prehistoric creatures. Removed from narratives of danger and extinction, the '
      + 'dinosaurs appear peaceful, almost sacred, within the quiet landscape. Their '
      + 'pixelated forms make them feel suspended between the ancient and the imagined, '
      + 'transforming them from monsters into enchanting figures of wonder.',
  }),
  /* DX-A5 */ work(5, [1600, 1201], {
    title: 'The Things We Carry', year: '2024', medium: 'Oil paint', dims: '22 × 16 in',
    description: 'This painting explores the tension between outward composure and an '
      + 'unruly inner life. While the woman remains poised and controlled, the grotesque '
      + 'creature beside her embodies resentment. An emotion made physical, lingering '
      + 'close despite attempts to contain it. Together, they suggest two sides of the '
      + 'same presence: the self we present and the feelings that refuse to remain '
      + 'hidden.',
  }),
  /* DX-A6 */ work(6, [1284, 1599], {
    title: 'Adulescentia', year: '2023', medium: 'Oil paint', dims: '16 × 11 in',
    sold: true,
    description: 'A regal girl and her monkey companion pose in quiet formality, '
      + 'blending portraiture with a subtle sense of fantasy and play.',
  }),
  /* DX-B1…B5 */ null, null, null, null, null,
  /* DX-C1 */ work(7, [1600, 1575], {
    title: 'Prehistoric Present', year: '2026', medium: 'Oil paint', dims: '30 × 30 in',
    description: 'This painting presents dinosaurs through shifting forms of '
      + 'representation. Moving deeper into the scene, they transform from a realistic '
      + 'fossil into loosely painted creatures, line drawings, and shadow-like forms. '
      + 'These changes offer multiple ways of seeing the dinosaur, as physical remains, '
      + 'imagined beast, symbol, and cultural memory.',
  }),
];

// What the foyer's title wall is lettered with and opens on E while her show
// is featured (data/featured.js, js/world/foyer.js).
export const DECETISE_CARD = {
  id: 'md-show-card',
  title: 'Paintings',
  artist: ARTIST,
  year: '', medium: 'About the artist',
  description: MARIA_DECETISE_BIO,
  contact: CONTACT,
};
