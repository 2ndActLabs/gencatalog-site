import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const helper = fs.readFileSync(new URL('../analytics.js', import.meta.url), 'utf8');
const html = fs.readFileSync(new URL('../get.html', import.meta.url), 'utf8');
assert(!/googletagmanager|google-analytics|gtag\(|link_url|page_location|utm_term/.test(html));
assert.match(html, /<meta name="referrer" content="no-referrer">/);
assert(!/setItem|sessionStorage|sendBeacon|fetch\(|XMLHttpRequest|gtag\(/.test(helper));
const inline = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(match => match[1]).join('\n');

function run({ ua = 'Windows', platform = 'Win32', search = '', referrer = '' } = {}) {
  const elements = new Map();
  const node = id => {
    if (!elements.has(id)) elements.set(id, { hidden: true, classList: { add() {} } });
    return elements.get(id);
  };
  let purged = 0;
  const checkout = { href: 'https://secondactlabs.lemonsqueezy.com/checkout/buy/33e4fb54-df7e-4135-b850-b7fe008a7ddb?checkout[custom][email]=private&utm_term=private#private' };
  const document = {
    readyState: 'complete', referrer, documentElement: { dataset: {} }, body: { classList: { add() {} } },
    querySelectorAll: () => [checkout], addEventListener() {}, getElementById: node
  };
  const location = new URL('https://gencatalog.app/get' + search);
  const window = {
    location, setTimeout: callback => callback(),
    localStorage: { removeItem: key => { assert.equal(key, 'gc_attribution_v1'); purged++; }, getItem: () => { throw new Error('History must not be read'); }, setItem: () => { throw new Error('History must not be written'); } },
    gtag: () => { throw new Error('No analytics calls are permitted'); },
    fetch: () => { throw new Error('No analytics network calls are permitted'); }
  };
  const context = { window, document, navigator: { userAgent: ua, platform }, location, URL, URLSearchParams, encodeURIComponent };
  vm.runInNewContext(helper, context);
  vm.runInNewContext(inline, context);
  assert.equal(purged, 1);
  const payment = new URL(checkout.href);
  assert.deepEqual([...payment.searchParams.keys()].sort(), ['channel', 'schema', 'source', 'surface'].map(key => `checkout[custom][${key}]`).sort());
  assert.equal(payment.searchParams.get('checkout[custom][source]'), 'website');
  assert(!checkout.href.includes('private'));
  assert.equal(checkout.rel, 'noreferrer noopener');
  return { elements, document, api: window.GenCatalogAttribution };
}

for (const source of ['extension_onboarding', 'extension_verify', 'google_organic', 'private@example.invalid', '__proto__']) {
  const { elements } = run({ search: '?source=' + encodeURIComponent(source) + '&channel=private&surface=private&utm_term=private&email=private' });
  const url = new URL(elements.get('primary').href);
  assert.match(url.pathname, /-Setup\.exe$/);
  assert.deepEqual([...url.searchParams.keys()].sort(), ['channel', 'source', 'surface']);
  assert(!url.toString().includes('private'));
  assert.equal(elements.get('download-frame').src, url.toString());
}
const mac = run({ ua: 'Macintosh', platform: 'MacIntel', search: '?manual=1', referrer: 'https://google.com/search?q=private' });
assert.match(mac.elements.get('primary').href, /-universal\.dmg/);
assert.equal(new URL(mac.elements.get('primary').href).searchParams.get('source'), 'google_organic');
assert.equal(mac.elements.get('download-frame').src, undefined, 'manual mode does not start a transfer');
const mobile = run({ ua: 'iPhone', platform: 'iPhone' });
assert.equal(mobile.elements.get('primary').href, 'https://gencatalog.app');
assert.equal(mobile.elements.get('download-frame').src, undefined, 'mobile does not request a desktop installer');
assert.equal(mac.api.downloadAttribution('', 'https://private.example.invalid/path?email=private').source, 'other_referral');
assert.equal(mac.api.downloadAttribution('', 'https://constructor/').source, 'other_referral');
assert(!JSON.stringify(mac.api.downloadAttribution('?source=__proto__', '')).includes('private'));
console.log('Download privacy, source allowlist, checkout labels, Windows/Mac/mobile and manual handoff: PASS');
