// The show the foyer opens onto. One hall is featured at a time: the door
// beside the reception desk leads there, the desk sign names it, and one of the
// artist's works hangs beside the door. Swap the featured show by editing this
// file and nothing else — the foyer, the curator, and the signage all read it.
//
// It is a schedule rather than a single entry, so a show can be booked ahead
// and change over on its own: each visit takes the latest show whose `from` has
// passed, by the visitor's own clock, when the page loads. No deploy has to
// land at midnight. A tab left open across the changeover keeps the old show
// until it is reloaded.
//
//   residencyId : which hall the door opens into (data/residencies.js id).
//   series      : the show's name as it appears on signage. Usually the hall is
//                 named after it, but the sign shouldn't have to say "Hall".
//   welcome     : how Mira names the show in her welcome, after "we're showing
//                 <artist> — ". Spelled out per show because "the whole of the
//                 Fall Series series" is what a template would say.
//   artworkId   : the one piece hung in the foyer beside the door, by id from
//                 the hall's own hang (searched in HANGS below).
//   card        : what the foyer's title wall is lettered with and opens on E.
//   from        : ISO time, UTC, the show takes the foyer. Null for the first.
//   opens       : the opening date as the poster prints it, while the show is
//                 still upcoming (js/world/foyer.js). Not necessarily `from`'s
//                 day: the door can open before the official opening.

import { findResidency } from './residencies.js';
import { CHADREA_HANG, SHOW_CARD as BEAUTIFUL_DECAY_CARD } from './chadrea-artworks.js';
import { ROCOCO_HANG, FALL_CARD } from './residency-artworks.js';

export const SHOWS = [
  {
    residencyId: 'chadrea',
    series: 'Beautiful Decay',
    welcome: 'the whole of the Beautiful Decay series',
    artworkId: 'cr-beautiful-decay-10',
    card: BEAUTIFUL_DECAY_CARD,
    from: null,
  },
  {
    residencyId: 'rococo',
    series: 'Fall Series',
    welcome: 'the whole of her Fall Series',
    artworkId: 'ec-american-layers',
    card: FALL_CARD,
    from: '2026-10-01T00:00:00Z',
    opens: 'October 2',
  },
];

const HANGS = [...CHADREA_HANG, ...ROCOCO_HANG];

// The moment the schedule is read against. `?now=<ISO time>` stands in for the
// clock, so the changeover can be previewed before it happens; anything that
// doesn't parse is ignored.
function now() {
  const q = new URLSearchParams(globalThis.location?.search || '').get('now');
  const t = q ? Date.parse(q) : NaN;
  return Number.isNaN(t) ? Date.now() : t;
}

const T = now();
const current = SHOWS.reduce(
  (at, s, i) => (s.from == null || Date.parse(s.from) <= T ? i : at), 0);

export const FEATURED = SHOWS[current];

// Shows that have had the foyer before this one, most recent first — the
// curator's past exhibits.
export const PAST_SHOWS = SHOWS.slice(0, current).reverse();

// The next show booked, if any — the foyer poster advertises it.
export const UPCOMING = SHOWS[current + 1] || null;

export function featuredResidency() {
  return findResidency(FEATURED.residencyId);
}

// The piece by the foyer door. Null only if the id above goes stale — the foyer
// then simply hangs nothing rather than crashing the boot.
export function featuredArtwork() {
  return artworkById(FEATURED.artworkId);
}

export function artworkById(id) {
  return HANGS.find((a) => a && a.id === id) || null;
}
