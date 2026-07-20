// ============================================================================
// THE COLLECTION MANIFEST
//
// The 17 works below are JFeelgood's real pieces, hung from the .webp files in
// assets/art/ (converted from the uploads in assets/image/artist/jfeelgood/).
//
// title comes from each uploaded file name. year / medium / price / description
// are editable placeholders — fill them in per piece, and point buyUrl at the
// work's page on minicuration.com.
//
// size is [width, height] in meters and is set to each photo's TRUE aspect
// ratio (height = width / (imgW / imgH)), so the frame matches the canvas and
// nothing is stretched. Width is still capped by the slot's maxW in
// js/world/layout.js; slot ids ('G-…' ground, 'M-…' mezzanine, 'C-…'
// courtyard) live there too. image null falls back to a generated placeholder.
// ============================================================================

const DESC = 'An original work by JFeelgood.';

export const ARTWORKS = [
  // --- ground floor --------------------------------------------------------
  {
    id: 'affordable-housing',
    title: 'Affordable Housing',
    year: '', medium: '', price: 'Inquire',
    buyUrl: 'https://minicuration.com/',
    image: 'assets/art/affordable-housing.webp',
    slot: 'G-N1', size: [2.4, 1.90],
    description: DESC,
  },
  {
    id: 'sentiments',
    title: 'Sentiments',
    year: '', medium: '', price: 'Inquire',
    buyUrl: 'https://minicuration.com/',
    image: 'assets/art/sentiments.webp',
    slot: 'G-N2', size: [2.4, 1.89],
    description: DESC,
  },
  {
    id: 'pride',
    title: 'Pride',
    year: '', medium: '', price: 'Inquire',
    buyUrl: 'https://minicuration.com/',
    image: 'assets/art/pride.webp',
    slot: 'G-W1', size: [1.5, 1.92],
    description: DESC,
  },
  {
    id: 'supernova',
    title: 'Supernova',
    year: '', medium: '', price: 'Inquire',
    buyUrl: 'https://minicuration.com/',
    image: 'assets/art/supernova.webp',
    slot: 'G-W2', size: [1.3, 1.87],
    description: DESC,
  },
  {
    id: 'permission',
    title: 'Permission',
    year: '', medium: '', price: 'Inquire',
    buyUrl: 'https://minicuration.com/',
    image: 'assets/art/permission.webp',
    slot: 'G-E1', size: [2.2, 1.10],
    description: DESC,
  },
  {
    id: 'best-friend',
    title: 'Best Friend',
    year: '', medium: '', price: 'Inquire',
    buyUrl: 'https://minicuration.com/',
    image: 'assets/art/best-friend.webp',
    slot: 'G-F1', size: [1.2, 1.58],
    description: DESC,
  },
  {
    id: 'businessman',
    title: 'Businessman',
    year: '', medium: '', price: 'Inquire',
    buyUrl: 'https://minicuration.com/',
    image: 'assets/art/businessman.webp',
    slot: 'G-F2', size: [1.2, 1.62],
    description: DESC,
  },
  {
    id: 'veritas',
    title: 'Veritas',
    year: '', medium: '', price: 'Inquire',
    buyUrl: 'https://minicuration.com/',
    image: 'assets/art/veritas.webp',
    slot: 'G-F3', size: [1.5, 1.10],
    description: DESC,
  },
  {
    id: 'colossal-waste-of-time',
    title: 'Colossal Waste of Time',
    year: '', medium: '', price: 'Inquire',
    buyUrl: 'https://minicuration.com/',
    image: 'assets/art/colossal-waste-of-time.webp',
    slot: 'G-F4', size: [1.5, 0.81],
    description: DESC,
  },
  // --- mezzanine -----------------------------------------------------------
  {
    id: 'vicarious',
    title: 'Vicarious',
    year: '', medium: '', price: 'Inquire',
    buyUrl: 'https://minicuration.com/',
    image: 'assets/art/vicarious.webp',
    slot: 'M-N1', size: [1.5, 2.00],
    description: DESC,
  },
  {
    id: 'a-simple-meditation',
    title: 'A Simple Meditation',
    year: '', medium: '', price: 'Inquire',
    buyUrl: 'https://minicuration.com/',
    image: 'assets/art/a-simple-meditation.webp',
    slot: 'M-N2', size: [1.35, 2.02],
    description: DESC,
  },
  {
    id: 'dream-mountain',
    title: 'Dream Mountain',
    year: '', medium: '', price: 'Inquire',
    buyUrl: 'https://minicuration.com/',
    image: 'assets/art/dream-mountain.webp',
    slot: 'M-W1', size: [1.4, 2.15],
    description: DESC,
  },
  {
    id: 'sweet-dreams',
    title: 'Sweet Dreams',
    year: '', medium: '', price: 'Inquire',
    buyUrl: 'https://minicuration.com/',
    image: 'assets/art/sweet-dreams.webp',
    slot: 'M-W2', size: [1.45, 1.98],
    description: DESC,
  },
  {
    id: 'liberty',
    title: 'Liberty',
    year: '', medium: '', price: 'Inquire',
    buyUrl: 'https://minicuration.com/',
    image: 'assets/art/liberty.webp',
    slot: 'M-S1', size: [1.6, 1.62],
    description: DESC,
  },
  {
    id: 'errands',
    title: 'Errands',
    year: '', medium: '', price: 'Inquire',
    buyUrl: 'https://minicuration.com/',
    image: 'assets/art/errands.webp',
    slot: 'M-E1', size: [1.8, 1.69],
    // Errands is a shaped, two-panel diptych: the source image is transparent
    // around the paint. transparent lets the wall show through those areas;
    // outline is the opaque silhouette as fractions of the source image (x east,
    // y from top) — a taller right panel and a lower-set left panel meeting at
    // the seam. The frame traces this outline instead of the image rectangle.
    transparent: true,
    outline: [
      [0.502, 0], [1, 0], [1, 0.680], [0, 0.680],
      [0, 0.285], [0.502, 0.285],
    ],
    description: DESC,
  },
  {
    id: 'zen-kernel',
    title: 'Zen Kernel',
    year: '', medium: '', price: 'Inquire',
    buyUrl: 'https://minicuration.com/',
    image: 'assets/art/zen-kernel.webp',
    slot: 'M-S2', size: [2.2, 1.78],
    description: DESC,
  },
  // --- the courtyard wall: works that live in open air ---------------------
  {
    id: 'dreamfall-big',
    title: 'Dreamfall',
    year: '', medium: '', price: 'Inquire',
    buyUrl: 'https://minicuration.com/',
    image: 'assets/art/dreamfall-big.webp',
    slot: 'C-S1', size: [1.8, 2.25],
    description: DESC,
  },
  {
    id: 'gentrification',
    title: 'Gentrification',
    year: '', medium: '', price: 'Inquire',
    buyUrl: 'https://minicuration.com/',
    image: 'assets/art/gentrification.webp',
    slot: 'C-E1', size: [2.4, 1.87],
    description: DESC,
  },
  {
    id: 'cornerstones',
    title: 'Cornerstones',
    year: '', medium: '', price: 'Inquire',
    buyUrl: 'https://minicuration.com/',
    image: 'assets/art/cornerstones.webp',
    slot: 'C-S3', size: [2.4, 1.92],
    description: DESC,
  },
];

export const GALLERY_INFO = {
  artist: 'JFeelgood',
  galleryName: 'iExploreArt',
  partner: { name: 'minicuration.com', url: 'https://minicuration.com/' },
};
