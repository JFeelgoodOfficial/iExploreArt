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
//   floor  : which floor the lift climbs to. Drives the ride length, so the
//            further up the residency, the longer the ride.
//   artist : resident's name. ← edit these to reassign residents.
//   blurb  : one line the curator uses when describing the room.

export const RESIDENCIES = [
  {
    id: 'courtyard',
    name: 'The Courtyard',
    floor: 1,
    artist: 'Aurelia Vance',
    blurb: 'three storeys of arcaded hallway around an open garden, hung the whole way round',
  },
  {
    id: 'nouveau',
    name: 'Nouveau Hall',
    floor: 2,
    artist: 'Erin Carle',
    blurb: 'a domed hall in leaded glass and mahogany, with a stair hall beyond the portal — seven pieces from her Spring Series are hanging there now',
  },
  {
    id: 'rococo',
    name: 'Rococo Hall',
    floor: 3,
    artist: 'Erin Carle',
    blurb: 'gilt boiserie under a painted ceiling, with a gallery running on three sides — she has hung the whole of the Fall Series across it, ten pieces',
  },
  {
    id: 'brutalist',
    name: 'Brutalism Hall',
    floor: 4,
    artist: 'Chad Rea',
    blurb: 'four storeys of board-formed concrete round one void — galleries ringing it at two levels, three cantilevered flights each against a different wall, and a foot of water lying on the glass at the top that you look down through, thirteen metres, to the floor; ten works hung flat on the concrete, unframed, and the pool runs out through the east wall to an edge with the city under it',
  },
];

// Metres per floor, so `floor` reads as a storey rather than a raw height.
export const FLOOR_HEIGHT = 4.4;

export function findResidency(id) {
  return RESIDENCIES.find((r) => r.id === id);
}
