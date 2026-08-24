// The curator's conversation tree — pure data, no DOM. The runner in
// js/curator/Curator.js interprets it. Choice actions:
//   next: 'nodeId'        → go to node
//   action: {type:'residencyList'}    → list the residency floors
//   action: {type:'residency', id}    → tell which room that artist works in
//   next: null            → end conversation

export const DIALOGUE = {
  start: {
    text: 'Welcome to iExploreArt. I’m Mira, the gallery’s curator. Everything on these walls is original work by JFeelgood — take your time with it. Is there anything I can tell you?',
    choices: [
      { label: 'Tell me about this gallery.', next: 'gallery' },
      { label: 'I’m looking for a resident artist.', next: 'residency' },
      { label: 'Just looking, thank you.', next: 'bye' },
    ],
  },

  gallery: {
    text: 'iExploreArt is two things at once — an exhibition hall and an artist residency. The main room you’re standing in hangs work by the gallery’s creator, the artist JFeelgood. The lift beside my desk carries you up to the artists of our privileged residency program, each of them given a floor of their own to work in and hang.',
    choices: [
      { label: 'I’m looking for a resident artist.', next: 'residency' },
      { label: 'Back.', next: 'start' },
    ],
  },

  residency: {
    text: 'Our residencies are upstairs — whole rooms, not studios behind a door. The lift just behind me goes to them; step in and press the floor. Shall I tell you what’s up there?',
    choices: [
      { label: 'Yes — what’s in residence?', action: { type: 'residencyList' } },
      { label: 'Back.', next: 'start' },
    ],
  },

  bye: {
    text: 'Of course. The gallery is yours — and if a painting holds you longer than you expected, that’s the one to ask me about.',
    choices: [
      { label: 'Thank you.', next: null },
    ],
  },
};
