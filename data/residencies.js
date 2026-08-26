// Artist residencies — one per room.
//
// A residency used to be a door: the courtyard had 27 of them, numbered, with a
// resident's name on a placard. It's now a whole room. The lift beside the
// reception desk (js/world/ReceptionLift.js) is the only way in: pick a
// residency, and the cabin rides up to that artist's floor.
//
// Each entry describes one destination:
//   id     : room id, matching the id registered with the RoomManager in main.js.
//   name   : shown on the lift button and by the curator.
//   slug   : the hall's share URL — visiting the page as #slug walks straight
//            into that hall after the loading screen (js/main.js). Raw ids work
//            too, but the slug is the one artists hand out.
//   floor  : which floor the lift climbs to. Drives the ride length, so the
//            further up the residency, the longer the ride.
//   artist : resident's name, when the room is credited to one. Omit it and the
//            curator and lift name the room alone. ← edit these to reassign.
//   blurb  : one line the curator uses when describing the room.
//   bio    : optional, and only meaningful alongside `artist` — the resident's
//            own words about their work. Give a room one and the curator offers
//            to talk about the artist as well as the room; leave it off and she
//            simply doesn't make the offer (js/curator/Curator.js).
//   pending: optional. The floor is spoken for, but the room isn't built yet —
//            there is no `id` in main.js's ROOM_FACTORIES to ride to. The lift
//            leaves it off the panel rather than offering a button that arrives
//            nowhere. Delete the flag when the room lands.
//   closed : optional. The room is built but shut to visitors. The lift won't
//            stop there; the curator still lists it, marked closed, so a
//            visitor asking after it gets an answer. Delete the flag to reopen.

// The residents' own words about their work. Exported, because they are read in
// two places that must not drift apart: the curator speaks them when asked
// about an artist, and each hall hangs a portrait whose wall label carries the
// same text (data/residency-artworks.js, data/chadrea-artworks.js). Erin Carle
// holds two floors, which is the other reason hers cannot live inside a single
// residency entry.
export const CHAD_REA_BIO = 'Drawing on pop, street, folk, and punk aesthetics, '
  + 'Chad Rea’s work transmutes the trauma and pain of the world into expressions of '
  + 'joy, hope, and belonging. Using tools mastered as an advertising Creative '
  + 'Director, he hopes to move people toward embracing their own humanity, finding '
  + 'everything advertising has always promised but never delivered already present '
  + 'within themselves. He is based in Lockhart, Texas.';

export const ERIN_CARLE_BIO = 'Erin Carle is a surrealist painter and curator whose work '
  + 'explores transformation, the natural world, and the complexities of the female '
  + 'experience. Through dreamlike imagery and symbolic narratives, she investigates '
  + 'cycles of growth, decay, metamorphosis, and resilience. Drawing from surrealist '
  + 'processes, her paintings blur the boundaries between the human body and nature, '
  + 'creating imagined worlds that examine identity, vulnerability, and power through '
  + 'subtle feminist undertones. Erin received her Bachelor of Fine Arts in Painting '
  + 'from Texas State University in 2022 and is currently an MFA candidate in Painting '
  + 'at the University of Texas San Antonio. Her work has been exhibited at venues '
  + 'including The George Washington Carver Museum in Austin, Texas; The Center for '
  + 'Contemporary Arts in Abilene, Texas; VOLTA Art Fair in Basel, Switzerland; Texas '
  + 'State Galleries in San Marcos, Texas; and other regional and international '
  + 'exhibitions.';

export const RESIDENCIES = [
  {
    // The hall the gallery was built around — the old reception room, minus
    // the reception, which moved out to the foyer. Not on the foyer's door,
    // but its share link (#hall-of-jfeelgood) walks straight in; you arrive
    // standing in the old lift cabin, doors open. Floor 0 keeps it off the
    // lift's own panel (js/world/ReceptionLift.js).
    id: 'gallery',
    name: 'Hall of JFeelgood',
    slug: 'hall-of-jfeelgood',
    floor: 0,
    artist: 'JFeelgood',
    blurb: 'the double-height hall the gallery was built around — nineteen of JFeelgood’s own works over two floors, a mezzanine, and a walled courtyard with a great tree',
  },
  {
    id: 'courtyard',
    name: 'The Courtyard',
    slug: 'courtyard',
    floor: 1,
    blurb: 'three storeys of arcaded hallway around an open garden, hung the whole way round',
  },
  {
    id: 'nouveau',
    name: 'Nouveau Hall',
    slug: 'nouveau-hall',
    floor: 2,
    artist: 'Erin Carle',
    blurb: 'a domed hall in leaded glass and mahogany, with a stair hall beyond the portal — seven pieces from her Spring Series are hanging there now',
    bio: ERIN_CARLE_BIO,
  },
  {
    id: 'rococo',
    name: 'Rococo Hall',
    slug: 'rococo-hall',
    floor: 3,
    artist: 'Erin Carle',
    blurb: 'gilt boiserie under a painted ceiling, with a gallery running on three sides — she has hung the whole of the Fall Series across it, ten pieces',
    bio: ERIN_CARLE_BIO,
  },
  {
    // Renamed twice at the artist's and the owner's direction: "Chadrea Hall"
    // read oddly beside the style-named halls, and the board-formed concrete
    // house earned the movement's name once the old Brutalism Hall upstairs
    // became Castle Hall. `aliases` keeps the show's previously shared links
    // working (js/main.js roomFromHash).
    id: 'chadrea',
    name: 'Brutalism Hall',
    slug: 'brutalism-hall',
    aliases: ['beautiful-decay-hall'],
    floor: 4,
    artist: 'Chad Rea',
    blurb: 'board-formed concrete under an eight-metre soffit, lit by a slot of skylight and a cove recessed the whole length of the art wall, with a cantilevered stair up to a mezzanine and a rounded plaster arch through the pier into a daylit wing; the whole of his Beautiful Decay series is hanging there now — twenty paintings, flat on the concrete and unframed, on every wall the building has, out to the pool in the courtyard',
    bio: CHAD_REA_BIO,
  },
  {
    id: 'decetise',
    name: 'Decetise Hall',
    slug: 'decetise-hall',
    floor: 5,
    artist: 'Maria Decetise',
    blurb: 'one whole floor plate five storeys up — a wall of glass over the city, '
      + 'and on the west no wall at all: the room opens straight onto an infinity pool '
      + 'that fills the terrace and runs off the edge of the building. The lift stands '
      + 'in the corner where the glass meets the north wall, and at the centre of a '
      + 'French parterre — gravel and clipped hedges and green park chairs — a stone '
      + 'fountain plays under five plane trees growing up through oculi cut in the '
      + 'ceiling, with four more out at the ends of the water; twelve works hang there '
      + '— six on the south art wall, five on the north, and one on the room-facing '
      + 'flank of the lift core itself',
  },
  {
    id: 'brutalist',
    name: 'Castle Hall',
    slug: 'castle-hall',
    floor: 6,
    closed: true,
    blurb: 'four storeys of board-formed concrete round one void — galleries ringing it at two levels, three cantilevered flights each against a different wall, and a foot of water lying on the glass at the top that you look down through, thirteen metres, to the floor; ten works hung flat on the concrete, unframed, and the pool runs out through the east wall to an edge with the city under it',
  },
];

// The ones the curator will talk about: everything that exists, whether or not
// the lift is stopping there today. A `pending` entry holds its floor number in
// the plan without putting a button on the panel that goes nowhere.
export const LISTED_RESIDENCIES = RESIDENCIES.filter((r) => !r.pending);

// The ones you can actually ride to — built and open. `findResidency` still
// searches them all, so a closed or coming room can still be described.
export const OPEN_RESIDENCIES = LISTED_RESIDENCIES.filter((r) => !r.closed);

// Metres per floor, so `floor` reads as a storey rather than a raw height.
export const FLOOR_HEIGHT = 4.4;

export function findResidency(id) {
  return RESIDENCIES.find((r) => r.id === id);
}
