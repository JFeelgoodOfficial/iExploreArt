// The curator's conversation tree — pure data, no DOM. The runner in
// js/curator/Curator.js interprets it. Choice actions:
//   next: 'nodeId'        → go to node
//   action: {type:'residencyList'}    → list every hall the gallery holds
//   action: {type:'residency', id}    → tell about that hall and its artist
//   action: {type:'pastShows'}        → list the shows the foyer has opened onto
//   next: null            → end conversation
//
// Mira stands in the foyer now, and the foyer opens onto one show at a time —
// so her welcome is built from data/featured.js at module load. Change the
// featured show there and she introduces the new one without an edit here; a
// show booked next gets a line of its own, and once one has come and gone she
// offers to talk about it.

import { FEATURED, PAST_SHOWS, UPCOMING, featuredResidency } from './featured.js';
import { findResidency } from './residencies.js';

const f = featuredResidency();
const next = UPCOMING && findResidency(UPCOMING.residencyId);

const upcomingLine = next
  ? ` And from ${UPCOMING.opens}, ${next.artist ? `${next.artist}’s ` : ''}${UPCOMING.series} opens in ${next.name}.`
  : '';

export const DIALOGUE = {
  start: {
    text: `Welcome to iExploreArt. I’m Mira, the curator. Just now we’re showing ${f.artist} — ${FEATURED.welcome}, hung through ${f.name}. The door beside my desk takes you straight in.${upcomingLine} Is there anything I can tell you?`,
    choices: [
      { label: 'Tell me about the show.', action: { type: 'residency', id: FEATURED.residencyId } },
      ...(PAST_SHOWS.length
        ? [{ label: 'What have you shown before?', action: { type: 'pastShows' } }]
        : []),
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
