// Artist residencies — one per courtyard door.
//
// The courtyard (js/world/CourtyardRoom.js) has 27 doors: 3 doors on each of the
// N, S and E walls, on each of the 3 storeys (the W wall is the elevator). Every
// door is a residency: a numbered room with a resident artist named on its placard.
// The rooms themselves aren't built out yet — this is signage + data only.
//
// Each entry ties a physical door to a room number and artist:
//   number : room number. Floor-based — 1xx ground, 2xx second, 3xx third.
//   floor  : storey index 0 | 1 | 2 (matches STOREYS in CourtyardRoom.js).
//   side   : wall the door sits on — 'N' | 'S' | 'E'.
//   u      : horizontal offset along that wall — -4.5 | 0 | 4.5.
//   artist : resident's name shown on the placard. ← edit these to assign residents.
//
// Ordering mirrors the door-building loop (CourtyardRoom.js): per storey, walls in
// order N, S, E, each with offsets -4.5, 0, 4.5. Keep that order so the room numbers
// stay stable and the receptionist's answers match the placards on the doors.

export const RESIDENCIES = [
  // --- Ground floor (101–109) ---
  { number: 101, floor: 0, side: 'N', u: -4.5, artist: 'Aurelia Vance' },
  { number: 102, floor: 0, side: 'N', u:  0.0, artist: 'Milo Kdesar' },
  { number: 103, floor: 0, side: 'N', u:  4.5, artist: 'Petra Halloran' },
  { number: 104, floor: 0, side: 'S', u: -4.5, artist: 'Idris Amend' },
  { number: 105, floor: 0, side: 'S', u:  0.0, artist: 'Sunniva Roe' },
  { number: 106, floor: 0, side: 'S', u:  4.5, artist: 'Caleb Ondine' },
  { number: 107, floor: 0, side: 'E', u: -4.5, artist: 'Noor Ellison' },
  { number: 108, floor: 0, side: 'E', u:  0.0, artist: 'Thaddeus Brack' },
  { number: 109, floor: 0, side: 'E', u:  4.5, artist: 'Liora Finch' },

  // --- Second floor (201–209) ---
  { number: 201, floor: 1, side: 'N', u: -4.5, artist: 'Emory Castellan' },
  { number: 202, floor: 1, side: 'N', u:  0.0, artist: 'Wren Aldous' },
  { number: 203, floor: 1, side: 'N', u:  4.5, artist: 'Sabine Toll' },
  { number: 204, floor: 1, side: 'S', u: -4.5, artist: 'Odalys Marsh' },
  { number: 205, floor: 1, side: 'S', u:  0.0, artist: 'Rafael Quinn' },
  { number: 206, floor: 1, side: 'S', u:  4.5, artist: 'Ines Vaughn' },
  { number: 207, floor: 1, side: 'E', u: -4.5, artist: 'Dorian Slate' },
  { number: 208, floor: 1, side: 'E', u:  0.0, artist: 'Marisol Vega' },
  { number: 209, floor: 1, side: 'E', u:  4.5, artist: 'Auden Pryce' },

  // --- Third floor (301–309) ---
  { number: 301, floor: 2, side: 'N', u: -4.5, artist: 'Cosima Brandt' },
  { number: 302, floor: 2, side: 'N', u:  0.0, artist: 'Elias Moreau' },
  { number: 303, floor: 2, side: 'N', u:  4.5, artist: 'Yara Solvang' },
  { number: 304, floor: 2, side: 'S', u: -4.5, artist: 'Bram Ostley' },
  { number: 305, floor: 2, side: 'S', u:  0.0, artist: 'Talia Reyes' },
  { number: 306, floor: 2, side: 'S', u:  4.5, artist: 'Fen Larkspur' },
  { number: 307, floor: 2, side: 'E', u: -4.5, artist: 'Anouk Devers' },
  { number: 308, floor: 2, side: 'E', u:  0.0, artist: 'Silas Marlowe' },
  { number: 309, floor: 2, side: 'E', u:  4.5, artist: 'Ravenna Ash' },
];

// Human-readable floor names, indexed by storey. Matches the lift panel wording
// in CourtyardRoom.js so the receptionist and the elevator stay consistent.
export const RESIDENCY_FLOOR_NAMES = ['the ground floor', 'the second floor', 'the third floor'];

// Find the residency for a physical door. Offsets are compared with tolerance so
// floating-point door positions still match.
export function findResidency(floor, side, u) {
  return RESIDENCIES.find(
    (r) => r.floor === floor && r.side === side && Math.abs(r.u - u) < 0.01
  );
}
