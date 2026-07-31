// Contain-fit an image's true aspect inside a slot envelope.
//
// Every hanging slot declares the largest frame its wall can take — (maxW, maxH)
// in metres — and every artwork declares its true pixel size. This returns the
// biggest [w, h] that fits inside the envelope at the picture's own aspect, so
// the FRAME is resized to the picture rather than the picture stretched to the
// frame. One of the two dimensions always lands exactly on the envelope.

export function fitToSlot(aspect, maxW, maxH) {
  return aspect >= maxW / maxH
    ? [maxW, maxW / aspect]   // wider than the envelope: width binds
    : [maxH * aspect, maxH];  // taller: height binds
}

// Bounding box [x0, y0, x1, y1] of a list of `outline` points — image fractions,
// x right and y down. A shaped work's real extent is its silhouette, not the
// file's rectangle, so anything sizing itself to the art rather than to the
// image measures it through here.
export function bboxOf(outline) {
  let x0 = 1, y0 = 1, x1 = 0, y1 = 0;
  for (const [x, y] of outline) {
    x0 = Math.min(x0, x); y0 = Math.min(y0, y);
    x1 = Math.max(x1, x); y1 = Math.max(y1, y);
  }
  return [x0, y0, x1, y1];
}
