// Custom events, sent to Google Analytics 4.
//
// index.html loads gtag.js and defines `gtag`, which pushes onto
// `window.dataLayer`; gtag.js drains that queue when it arrives, so events
// fired before the script lands still count. Nothing here is allowed to throw:
// a blocked beacon, an ad blocker eating the tag, or a malformed payload must
// never stop someone walking into the gallery.

/**
 * Send a custom event to Google Analytics 4.
 *
 * @param {string} name  Readable event name ("Enquiry Opened"). GA4 gets the
 *        snake_case form ("enquiry_opened"), its own naming rule.
 * @param {Object<string, string|number|boolean|null>} [data]
 *        Optional properties. Only flat primitive values are kept; keys are
 *        sent in snake_case too (workId → work_id).
 */
export function track(name, data) {
  try {
    if (typeof window.gtag !== 'function' || !name) return;
    const params = {};
    for (const [k, v] of Object.entries(data || {})) {
      const t = typeof v;
      // GA4 treats a null parameter as absent anyway; leaving it out keeps
      // "(not set)" from filling the report.
      if (t === 'string' || t === 'number' || t === 'boolean') params[snake(k)] = v;
    }
    window.gtag('event', snake(name), params);
  } catch {
    /* analytics is never worth a broken gallery */
  }
}

// "Enquiry Opened" → "enquiry_opened", "workId" → "work_id".
function snake(s) {
  return String(s)
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/[^A-Za-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toLowerCase();
}
