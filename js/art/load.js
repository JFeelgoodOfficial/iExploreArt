import * as THREE from 'three';
import { queueUpload } from '../utils/texqueue.js';

// Loading a photograph onto a wall, shared by the residency halls.
//
// ImageBitmapLoader decodes off the main thread — worth the detour here, since
// each hall drops a dozen 1600px files at once and does it right after the
// travel veil lifts, where a main-thread decode reads as a stall. The
// pre-flipped bitmap plus flipY:false reproduces TextureLoader's orientation
// exactly (same trick as js/art/Artworks.js); TextureLoader stays the fallback
// for browsers without createImageBitmap.
//
// `maxEdge` caps the decoded size. A 2.45 m canvas fills roughly 900 screen
// pixels, so the 1600px files in assets/art are already generous on a phone and
// each one costs ~13 MB of texture memory with mipmaps — the low tier trades it
// away in the resize.
// It buys memory and nothing else: createImageBitmap resizes a file that has
// already arrived, so the bytes on the wire are whatever is in assets/art.
// Transfer is the encode's problem, not this cap's.

// Halls built ahead of their first visit (js/main.js preloads the featured one
// while the loading screen is up) want the geometry early and the photographs
// late: a hall's hang is a dozen megabytes, and a visitor who never opens that
// door should never pay for it. `withDeferredArt` holds every loadArtTexture
// call made during a build behind a promise; resolve it when the hall is
// actually entered and the requests go out then. Nothing is queued if the
// promise never settles, which is the whole point.
//
// The gate is read at call time and restored afterwards, so builds that are not
// deferred — every hall reached by the lift or a door, built on arrival — are
// untouched and load their art immediately, as before.

let deferral = null;

export function withDeferredArt(until, build) {
  const outer = deferral;
  deferral = until;
  try {
    return build();
  } finally {
    deferral = outer;
  }
}

// The gate itself, for callers that own their loader rather than going through
// loadArtTexture — js/art/Artworks.js hangs the Hall of JFeelgood with a shaped
// crop this function knows nothing about.
export function onArtRelease(run) {
  const gate = deferral;
  if (gate) {
    gate.then(run, () => {});
    return;
  }
  run();
}

export function loadArtTexture(url, opts, onReady) {
  onArtRelease(() => request(url, opts, onReady));
}

function request(url, opts, onReady) {
  const { anisotropy = 8, px = null, maxEdge = 0 } = opts || {};
  const src = encodeURI(url);   // the uploaded file names carry spaces

  const ready = (t) => {
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = anisotropy;
    t.needsUpdate = true;
    queueUpload(t);   // paced GPU upload, not on first draw
    onReady(t);
  };

  if (typeof createImageBitmap === 'function') {
    const loader = new THREE.ImageBitmapLoader();
    loader.setOptions({
      imageOrientation: 'flipY',
      colorSpaceConversion: 'none',
      ...resizeFor(px, maxEdge),
    });
    loader.load(src, (bitmap) => {
      const t = new THREE.Texture(bitmap);
      t.flipY = false;   // the bitmap is already flipped via imageOrientation
      ready(t);
    }, undefined, () => console.warn(`[art] could not load ${url}`));
    return;
  }
  new THREE.TextureLoader().load(src, ready, undefined,
    () => console.warn(`[art] could not load ${url}`));
}

// createImageBitmap resizes during decode, so an oversized source never costs
// full resolution in memory. Needs the source dimensions up front, which is why
// the manifest carries `px`; without them, decode at native size.
function resizeFor(px, maxEdge) {
  if (!px || !maxEdge) return {};
  const [w, h] = px;
  const long = Math.max(w, h);
  if (long <= maxEdge) return {};
  const k = maxEdge / long;
  return {
    resizeWidth: Math.round(w * k),
    resizeHeight: Math.round(h * k),
    resizeQuality: 'high',
  };
}
