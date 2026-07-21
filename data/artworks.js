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
    year: '', medium: '24" × 30" · Acrylic on canvas, epoxy resin',
    image: 'assets/art/pride.webp',
    slot: 'G-W1', size: [1.5, 1.92],
    description: 'Work, no matter the urgency or size, has purpose. If I do not enjoy it, then the effort means nothing and I miss out on life. Wisdom suggests the importance of a devoted outlook.',
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
    year: '', medium: '40" × 30" · Acrylic on canvas, epoxy resin',
    image: 'assets/art/permission.webp',
    slot: 'G-E1', size: [2.2, 1.10],
    description: 'Brilliant and mighty power. Sometimes, I seek it from others long before I consider it coming from myself. The burden of permission is great. Once I permit myself, I am then indebted to that permission. Without discipline, it is nearly impossible to return to the respect for the weight of what has been permitted. Familiarity is the greatest weakness of the evolving spirit and I long for it in all of my endeavors. Even in the unknown I find a familiar solace, a mirror of my imagination. Am I mindful of what my actions are that people consider permission in their lives? Am I mindful of the permissions I grant myself?',
  },
  {
    id: 'best-friend',
    title: 'Best Friend',
    year: '', medium: '30" × 40" · Acrylic on canvas, wood panel, epoxy resin',
    image: 'assets/art/best-friend.webp',
    slot: 'G-F1', size: [1.2, 1.58],
    description: 'Always there. In the shadows or in the spotlight. The monster thrives on fear and will put me in positions that make me afraid and vulnerable. With patience, I face my fears as they present themselves. Vulnerability is the precursor to authenticity. I grow bigger than my fears because I have them. What feeds the monster, feeds me.',
  },
  {
    id: 'businessman',
    title: 'Businessman',
    year: '', medium: '30" × 40" · Acrylic on canvas, wood panel, epoxy resin',
    image: 'assets/art/businessman.webp',
    slot: 'G-F2', size: [1.2, 1.62],
    description: 'Alignment solely with wealth building and material systems keeps my emotional and spiritual growth inhibited.',
  },
  {
    id: 'veritas',
    title: 'Veritas',
    year: '', medium: '24" × 30" · Mixed media on canvas',
    image: 'assets/art/veritas.webp',
    slot: 'G-F3', size: [1.5, 1.10],
    description: 'A transparent princess on stage, framed by chaotic color. An exploration of authenticity, performance, and the cost of being who others expect instead of who you are.',
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
    year: '', medium: '29.5" × 30.5" · Acrylic on canvas, epoxy resin',
    image: 'assets/art/vicarious.webp',
    slot: 'M-N1', size: [1.5, 2.00],
    description: 'Living in the throes of imagination, I am aged by experiences of a thousand lifetimes, at the cost of growing closer to real people.',
  },
  {
    id: 'a-simple-meditation',
    title: 'A Simple Meditation',
    year: '', medium: '',
    image: 'assets/art/a-simple-meditation.webp',
    slot: 'M-N2', size: [1.35, 2.02],
    description: 'A piece built to be a breathing space – simple forms, mindful mark-making, and a soft place for your attention to land when the rest of life is loud.',
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
    // outline traces the true opaque silhouette as fractions of the source image
    // (x east, y from top) — a taller right panel (top-aligned, ends higher) and
    // a lower-set left panel. The frame follows the paint exactly, so the notch
    // below the right panel stays open to the wall rather than being boxed in.
    transparent: true,
    outline: [
      [0.502, 0], [1, 0], [1, 0.564], [0.502, 0.564],
      [0.502, 0.680], [0, 0.680], [0, 0.285], [0.502, 0.285],
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
