// The curator's conversation tree — pure data, no DOM. The runner in
// js/curator/Curator.js interprets it. Choice actions:
//   next: 'nodeId'        → go to node
//   action: {type:'link', url}       → open external page
//   action: {type:'artworkList', floor}  → expand collection into choices
//   action: {type:'artwork', id}     → open that artwork's panel
//   next: null            → end conversation

export const DIALOGUE = {
  start: {
    text: 'Welcome to iExploreArt. I’m Mira, the gallery’s curator. Everything on these walls is original work by JFeelgood — take your time with it. Is there anything I can tell you?',
    choices: [
      { label: 'Tell me about this gallery.', next: 'gallery' },
      { label: 'Who is JFeelgood?', next: 'artist' },
      { label: 'Tell me about the works on display.', next: 'collection' },
      { label: 'How do I purchase a piece?', next: 'purchase' },
      { label: 'Just looking, thank you.', next: 'bye' },
    ],
  },

  gallery: {
    text: 'iExploreArt began as a place where the work could live inside its own context — part gallery, part journal, part guide. The ground floor holds the newer paintings; the stairs by the east wall lead to the upper gallery. And do spend a moment at the south glass — the courtyard tree is at its best in this light.',
    choices: [
      { label: 'Who is the artist?', next: 'artist' },
      { label: 'What’s on display?', next: 'collection' },
      { label: 'Back.', next: 'start' },
    ],
  },

  artist: {
    text: '“My idea was to escape a sense of contrived concept, while keeping my presence in pure, unadulterated, raw, honest expression.” That’s JFeelgood in their own words. The paintings aren’t planned — they’re responsive, built from gesture, pushed until something true appears. Some arrive in an afternoon; others take weeks. Neither kind is rushed.',
    choices: [
      { label: 'What should I look for in the work?', next: 'looking' },
      { label: 'Show me the collection.', next: 'collection' },
      { label: 'Back.', next: 'start' },
    ],
  },

  looking: {
    text: 'JFeelgood talks about the difference between a mark that’s placed and a mark that’s made. Look for the made ones — the strokes that clearly happened at speed, without correction. The palette runs warm and textural: teal, terracotta, ink. Stand close first, then step back until the painting resolves.',
    choices: [
      { label: 'Show me the collection.', next: 'collection' },
      { label: 'Back.', next: 'start' },
    ],
  },

  collection: {
    text: 'Nineteen works hang today — including three in the courtyard, our room with no ceiling. Walk up to any painting to hear more, or I can point you to a piece directly. Where shall we start?',
    choices: [
      { label: 'The ground floor.', action: { type: 'artworkList', floor: 'G' } },
      { label: 'The upper gallery.', action: { type: 'artworkList', floor: 'M' } },
      { label: 'The courtyard.', action: { type: 'artworkList', floor: 'C' } },
      { label: 'Back.', next: 'start' },
    ],
  },

  collectionList: {
    // text is set dynamically by the runner
    text: 'Here’s what hangs there:',
    choices: [], // filled dynamically; runner appends a Back choice
  },

  purchase: {
    text: 'Every original is available through our partner, minicuration.com — they handle acquisition, payment, and careful shipping worldwide. Open any painting’s panel and choose “Collect”, or I can take you to the collection page now.',
    choices: [
      { label: 'Open minicuration.com', action: { type: 'link', url: 'https://minicuration.com/' } },
      { label: 'Maybe later.', next: 'start' },
    ],
  },

  bye: {
    text: 'Of course. The gallery is yours — and if a painting holds you longer than you expected, that’s the one to ask me about.',
    choices: [
      { label: 'Thank you.', next: null },
    ],
  },
};
