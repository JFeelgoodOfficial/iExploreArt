// Maria Decetise — Decetise Hall (js/world/decetise.js), floor 5.
//
// Same shape as data/chadrea-artworks.js: the hang in slot order, the show
// card the foyer's title wall opens, and the contact block every label carries
// behind its enquiry button. Kept out of the room's own file so the foyer and
// the curator can read it without pulling in the room's geometry.
//
// The photographs arrived without titles or sizes, so every work is
// "Untitled" for now and hangs at its photograph's aspect, fitted into the
// slot (decetise.js). Give one a `title` and it reads on the placard and the
// label; the id and the file stay put.

import { MARIA_DECETISE_BIO } from './residencies.js';

const ARTIST = 'Maria Decetise';
const HALL = 'Decetise Hall';

const CONTACT = {
  name: ARTIST,
  links: [
    { handle: '@mdecetiseart', url: 'https://www.instagram.com/mdecetiseart', label: 'instagram.com/mdecetiseart' },
  ],
};

const work = (n, px, title = 'Untitled') => ({
  id: `md-${n}`,
  title, artist: ARTIST,
  year: '', medium: '',
  image: `assets/art/decetise/Decetise ${n}.webp`,
  px,
  description: `By ${ARTIST}, in residence in ${HALL}.`,
  contact: CONTACT,
});

// Slot order is SLOTS[] in js/world/decetise.js: the south art wall west to
// east (DX-A1…A6), then the north wall (DX-B1…B5), then the face of the lift
// core (DX-C1). Six hang on the south wall, the one a visitor faces stepping
// out of the lift. The square and the portrait take the two ends; the four
// landscapes run between them, the two quiet interiors alternating with the
// pulp-cover pieces. The seventh hangs on the lift core's west face, beside
// the cabin doors. The north wall's five slots stay empty (decetise.js skips
// a null entry).
export const DECETISE_HANG = [
  /* DX-A1 */ work(1, [1284, 1278]),   // swordswoman and the desert beast
  /* DX-A2 */ work(2, [1284, 1021]),   // riding with the panthers
  /* DX-A3 */ work(3, [1165, 875]),    // two women, the ship and the swan
  /* DX-A4 */ work(4, [1600, 1149]),   // the pixel dinosaurs
  /* DX-A5 */ work(5, [1600, 1201]),   // the creature and the pink dress
  /* DX-A6 */ work(6, [1284, 1599]),   // the capuchin
  /* DX-B1…B5 */ null, null, null, null, null,
  /* DX-C1 */ work(7, [1600, 1575]),   // two women in the cave, the skeleton
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
