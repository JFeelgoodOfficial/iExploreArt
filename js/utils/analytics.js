// Custom events, reported to two places at once.
//
// Vercel Web Analytics is the one the site is deployed on: index.html seeds
// `window.va` with the queue stub and defers the real script from
// cdn.vercel-insights.com, so events fired before that script lands are
// replayed once it does. It counts pageviews on every plan, but it only
// COLLECTS custom events on Pro and Enterprise — on Hobby the beacons below go
// nowhere you can read, and even on Pro only two data properties per event are
// kept. That is why Google Analytics 4 is here beside it: it takes custom
// events and their properties for free, and the day the Vercel plan changes,
// the same calls are already landing in both.
//
// Nothing here is allowed to throw: a blocked beacon, an ad blocker eating
// either script, or a malformed payload must never stop someone walking into
// the gallery.

// ---------------------------------------------------------------------------
// Google Analytics 4 — paste the property's Measurement ID here, the
// G-XXXXXXXXXX from GA's Admin → Data streams → your web stream. It is a public
// identifier and belongs in the repo; it is not a secret.
//
// Left empty, GA is simply never started: no script is fetched, no cookie is
// set, and track() still reports to Vercel. So the gallery runs unchanged until
// the ID is filled in.
// ---------------------------------------------------------------------------
export const GA_MEASUREMENT_ID = '';

/**
 * Send a custom event to both analytics services.
 *
 * @param {string} name  Event name as it appears in the Vercel dashboard.
 *        GA4 gets the same name in its own snake_case spelling, so
 *        'Enquiry Opened' reads as `enquiry_opened` there.
 * @param {Object<string, string|number|boolean|null>} [data]
 *        Optional properties. Both services only accept flat string / number /
 *        boolean / null values, so nested objects are dropped below.
 */
export function track(name, data) {
  if (!name) return;
  const clean = flatten(data);
  toVercel(name, clean);
  toGA(name, clean);
}

function toVercel(name, data) {
  try {
    if (typeof window.va !== 'function') return;
    const payload = { name };
    if (data) payload.data = data;
    window.va('event', payload);
  } catch {
    /* analytics is never worth a broken gallery */
  }
}

// GA4 is stricter than Vercel about what an event may be called: names and
// property keys are snake_case, start with a letter, and stop at 40 characters,
// and a string value stops at 100. Everything is rewritten to fit rather than
// rejected, so adding an event here never means learning GA's rules first.
function toGA(name, data) {
  try {
    if (typeof window.gtag !== 'function') return;
    const params = {};
    for (const [k, v] of Object.entries(data || {})) {
      if (v === null) continue;                        // GA has no use for an empty column
      const key = gaKey(k);
      if (!key) continue;
      params[key] = typeof v === 'string' ? v.slice(0, 100)
        : typeof v === 'boolean' ? String(v)
          : v;
    }
    window.gtag('event', gaKey(name) || 'event', params);
  } catch {
    /* as above */
  }
}

// 'Enquiry Opened' → enquiry_opened, 'workId' → work_id. A name that would not
// start with a letter is prefixed rather than dropped, since GA rejects the
// whole event over it.
function gaKey(s) {
  const out = String(s)
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40);
  if (!out) return '';
  return /^[a-z]/.test(out) ? out : `x_${out}`.slice(0, 40);
}

// Keep only the primitive values both services accept, and return undefined
// rather than an empty object so events without properties stay clean.
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

// Start GA4 on import — the same gtag.js snippet Google hands out, written as
// code so the tag is not in the page when no ID is set. `gtag` is the queue
// itself, so events fired before googletagmanager.com answers (or while it is
// being blocked) are held rather than lost; the pageview comes from `config`.
(function startGA() {
  try {
    if (!GA_MEASUREMENT_ID || typeof document === 'undefined') return;
    window.dataLayer = window.dataLayer || [];
    // eslint-disable-next-line func-style
    window.gtag = window.gtag || function gtag() { window.dataLayer.push(arguments); };
    window.gtag('js', new Date());
    window.gtag('config', GA_MEASUREMENT_ID);
    const s = document.createElement('script');
    s.async = true;
    s.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(GA_MEASUREMENT_ID)}`;
    document.head.appendChild(s);
  } catch {
    /* no analytics is better than no gallery */
  }
}());
