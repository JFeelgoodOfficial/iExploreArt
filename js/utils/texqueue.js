// Paced GPU texture uploads. Decoded textures are queued here and uploaded a
// few per frame via renderer.initTexture, so the decode/upload cost is spread
// across frames — almost all of it behind the loading screen — instead of
// hitching the first frame each texture is drawn.

const queue = [];

export function queueUpload(texture) {
  if (texture) queue.push(texture);
}

export function drainUploads(renderer, max = 1) {
  let n = 0;
  while (queue.length && n < max) {
    const t = queue.shift();
    try { renderer.initTexture(t); } catch (e) { /* disposed before upload */ }
    n++;
  }
}

export function pendingUploads() { return queue.length; }
