// Vercel Web Analytics — custom events.
//
// index.html seeds `window.va` with the queue stub and defers the real script
// from cdn.vercel-insights.com, so events fired before that script lands are
// replayed once it does. Nothing here is allowed to throw: a blocked beacon,
// an ad blocker eating the stub, or a malformed payload must never stop
// someone walking into the gallery.

/**
 * Send a custom event to Vercel Web Analytics.
 *
 * @param {string} name  Event name as it appears in the Vercel dashboard.
 * @param {Object<string, string|number|boolean|null>} [data]
 *        Optional properties. Vercel only accepts flat string / number /
 *        boolean / null values, so nested objects are dropped below.
 */
export function track(name, data) {
  try {
    if (typeof window.va !== 'function' || !name) return;
    const payload = { name };
    const clean = flatten(data);
    if (clean) payload.data = clean;
    window.va('event', payload);
  } catch {
    /* analytics is never worth a broken gallery */
  }
}

// Keep only the primitive values Vercel accepts, and return undefined rather
// than an empty object so events without properties stay clean.
function flatten(data) {
  if (!data || typeof data !== 'object') return undefined;
  const out = {};
  let n = 0;
  for (const [k, v] of Object.entries(data)) {
    const t = typeof v;
    if (v === null || t === 'string' || t === 'number' || t === 'boolean') {
      out[k] = v;
      n++;
    }
  }
  return n ? out : undefined;
}
