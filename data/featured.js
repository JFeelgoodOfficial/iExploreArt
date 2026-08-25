// The show the foyer opens onto. One hall is featured at a time: the door
// beside the reception desk leads there, the desk sign names it, and one of the
// artist's works hangs beside the door. Swap the featured show by editing this
// file and nothing else — the foyer, the curator, and the signage all read it.
//
//   residencyId : which hall the door opens into (data/residencies.js id).
//   series      : the show's name as it appears on signage. Usually the hall is
//                 named after it, but the sign shouldn't have to say "Hall".
//   artworkId   : the one piece hung in the foyer beside the door, by id from
//                 the hall's own hang — imported below, so swap the import
//                 together with the id when the featured show changes.

import { findResidency } from './residencies.js';
import { CHADREA_HANG } from './chadrea-artworks.js';

export const FEATURED = {
  residencyId: 'chadrea',
  series: 'Beautiful Decay',
  artworkId: 'cr-beautiful-decay-10',
};

export function featuredResidency() {
  return findResidency(FEATURED.residencyId);
}

// The piece by the foyer door. Null only if the id above goes stale — the foyer
// then simply hangs nothing rather than crashing the boot.
export function featuredArtwork() {
  return CHADREA_HANG.find((a) => a.id === FEATURED.artworkId) || null;
}
