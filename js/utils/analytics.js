// Custom events, sent to both Vercel Web Analytics and Google Analytics 4.
//
// index.html seeds `window.va` with the queue stub and defers the real script
// from cdn.vercel-insights.com, so events fired before that script lands are
// replayed once it does. It does the same for GA4: `gtag` pushes onto
// `window.dataLayer`, which gtag.js drains when it arrives. Nothing here is
// allowed to throw: a blocked beacon, an ad blocker eating either stub, or a
// malformed payload must never stop someone walking into the gallery.

/**
 * Send a custom event to Vercel Web Analytics and Google Analytics 4.
 *
 * @param {string} name  Event name as it appears in the Vercel dashboard
 *        ("Enquiry Opened"). GA4 gets the snake_case form ("enquiry_opened"),
 *        its own naming rule.
 * @param {Object<string, string|number|boolean|null>} [data]
 *        Optional properties. Both services only take flat primitive values,
 *        so nested objects are dropped below. GA4 gets the keys in snake_case
 *        too (workId → work_id).
 */
export function track(name, data) {
  if (!name) return;
  const clean = flatten(data);
  try {
    if (typeof window.va === 'function') {
      const payload = { name };
      if (clean) payload.data = clean;
      window.va('event', payload);
    }
  } catch {
    /* analytics is never worth a broken gallery */
  }
  try {
    if (typeof window.gtag === 'function') {
      const params = {};
      for (const [k, v] of Object.entries(clean || {})) {
        // GA4 treats a null parameter as absent anyway; leaving it out keeps
        // "(not set)" from filling the report.
        if (v !== null) params[snake(k)] = v;
      }
      window.gtag('event', snake(name), params);
    }
  } catch {
    /* same */
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

// "Enquiry Opened" → "enquiry_opened", "workId" → "work_id".
function snake(s) {
  return String(s)
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/[^A-Za-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toLowerCase();
}
