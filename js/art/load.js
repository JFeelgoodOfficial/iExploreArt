import * as THREE from 'three';
import { queueUpload } from '../utils/texqueue.js';

// Loading a photograph onto a wall, shared by the residency halls.
//
// ImageBitmapLoader decodes off the main thread — worth the detour here, since
// each hall drops a dozen 2048px files at once and does it right after the
// travel veil lifts, where a main-thread decode reads as a stall. The
// pre-flipped bitmap plus flipY:false reproduces TextureLoader's orientation
// exactly (same trick as js/art/Artworks.js); TextureLoader stays the fallback
// for browsers without createImageBitmap.
//
// `maxEdge` caps the decoded size. A 2.45 m canvas fills roughly 900 screen
// pixels, so 2048 is already generous on a phone and each one costs ~22 MB of
// texture memory with mipmaps — the low tier trades it away in the resize.

export function loadArtTexture(url, opts, onReady) {
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
