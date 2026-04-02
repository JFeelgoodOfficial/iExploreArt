/*
 * ═══════════════════════════════════════════════════════
 *  iExploreArt — Blog Post Data
 *  HOW TO ADD A NEW POST:
 *  1. Duplicate a post object below and fill in your details.
 *  2. Create a new file at: blog/posts/your-slug.html
 *  3. Save posts.js and commit. That's it.
 * ═══════════════════════════════════════════════════════
 */

const CATEGORIES = [
  "Painting Analysis",
  "Artist Features",
  "Abstract Art",
  "Collecting & Discovery",
  "Process & Studio Notes"
];

const CATEGORY_DESCRIPTIONS = {
  "Painting Analysis":      "Focused written interpretations that unpack symbolism, composition, emotion, and meaning in individual works.",
  "Artist Features":        "Spotlights on artists—their story, their process, and what drives them to create.",
  "Abstract Art":           "Exploring the language of abstraction: colour, gesture, form, and feeling.",
  "Collecting & Discovery": "Guidance for collectors and curious viewers navigating the world of original art.",
  "Process & Studio Notes": "First-person notes on what happens in the studio—experiments, breakthroughs, and honest reflection."
};

const POSTS = [
  {
    id: 1,
    title: "Unfiltered Expression: A Reading of A Simple Meditation",
    slug: "unfiltered-expression-simple-meditation",
    date: "2026-03-15",
    dateDisplay: "March 15, 2026",
    category: "Painting Analysis",
    excerpt: "A closer reading of "A Simple Meditation," framed around introspection, raw gesture, and inner peace.",
    thumb: null,          // e.g. "../../images/simple-meditation.jpg"
    readTime: "6 min",
    featured: true,
    url: "https://iexploreart.com/painting-analysis/a-simple-meditation/"
  },
  {
    id: 2,
    title: "How to Create Abstract Art: A Step-by-Step Guide",
    slug: "how-to-create-abstract-art",
    date: "2026-02-28",
    dateDisplay: "February 28, 2026",
    category: "Process & Studio Notes",
    excerpt: "A practical piece on inspiration, spontaneity, and building abstract work thro
