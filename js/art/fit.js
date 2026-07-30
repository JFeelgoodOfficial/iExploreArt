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
