// The curator's conversation tree — pure data, no DOM. The runner in
// js/curator/Curator.js interprets it. Choice actions:
//   next: 'nodeId'        → go to node
//   action: {type:'residencyList'}    → list every hall the gallery holds
//   action: {type:'residency', id}    → tell about that hall and its artist
//   next: null            → end conversation
//
// Mira stands in the foyer now, and the foyer opens onto one show at a time —
// so her welcome is built from data/featured.js at module load. Change the
// featured show there and she introduces the new one without an edit here.

import { FEATURED, featuredResidency } from './featured.js';

const f = featuredResidency();

export const DIALOGUE = {
  start: {
    text: `Welcome to iExploreArt. I’m Mira, the curator. Just now we’re showing ${f.artist} — the whole of the ${FEATURED.series} series, hung through ${f.name}. The door beside my desk takes you straight in. Is there anything I can tell you?`,
    choices: [
      { label: 'Tell me about the show.', action: { type: 'residency', id: FEATURED.residencyId } },
      { label: 'What else does iExploreArt hold?', action: { type: 'residencyList' } },
      { label: 'Just looking, thank you.', next: 'bye' },
    ],
  },

  bye: {
    text: 'Of course. The gallery is yours — and if a painting holds you longer than you expected, that’s the one to ask me about.',
    choices: [
      { label: 'Thank you.', next: null },
    ],
  },
};
