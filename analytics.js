// Bounded link labels only. No analytics requests, cookies, or visitor history.
(function () {
  'use strict';
  var DOWNLOAD_SOURCES = [
    'website', 'direct', 'unknown', 'extension_onboarding', 'extension_verify', 'extension_popup',
    'google_organic', 'bing_organic', 'duckduckgo_organic', 'yahoo_organic', 'ecosia_organic', 'brave_organic',
    'reddit_referral', 'youtube_referral', 'perplexity_referral', 'chatgpt_referral', 'other_referral'
  ];
  var CHECKOUT_SOURCES = ['website', 'desktop_trial', 'desktop_settings', 'desktop_license_wall', 'desktop_license_dialog', 'extension', 'unknown'];

  function downloadAttribution(search, referrer) {
    var supplied = new URLSearchParams(search || '').get('source');
    var source = DOWNLOAD_SOURCES.indexOf(supplied) !== -1 ? supplied : '';
    if (!source && referrer) {
      try {
        var host = new URL(referrer).hostname.replace(/^www\./, '').toLowerCase();
        var sources = {
          'google.com': 'google_organic', 'bing.com': 'bing_organic', 'duckduckgo.com': 'duckduckgo_organic',
          'yahoo.com': 'yahoo_organic', 'ecosia.org': 'ecosia_organic', 'search.brave.com': 'brave_organic',
          'reddit.com': 'reddit_referral', 'youtube.com': 'youtube_referral',
          'perplexity.ai': 'perplexity_referral', 'chatgpt.com': 'chatgpt_referral'
        };
        source = host === 'gencatalog.app' ? 'website'
          : Object.prototype.hasOwnProperty.call(sources, host) ? sources[host] : 'other_referral';
      } catch (_) { source = 'unknown'; }
    }
    source = source || (supplied ? 'unknown' : 'direct');
    return {
      source: source,
      channel: source.indexOf('extension_') === 0 ? 'chrome_extension'
        : source.indexOf('_organic') !== -1 ? 'organic_search'
        : ['chatgpt_referral', 'perplexity_referral'].indexOf(source) !== -1 ? 'ai_referral'
        : source.indexOf('_referral') !== -1 ? 'referral' : 'website',
      surface: source.indexOf('extension_') === 0 ? 'extension_popup' : 'website'
    };
  }

  function decorateDownloadUrl(href, attribution) {
    var url = new URL(href, window.location.href);
    if (url.protocol !== 'https:' || url.hostname !== 'downloads.gencatalog.app' || url.username || url.password) return href;
    url.search = '';
    url.hash = '';
    var safe = downloadAttribution('?source=' + encodeURIComponent(attribution.source || 'unknown'), '');
    ['source', 'channel', 'surface'].forEach(function (key) { url.searchParams.set(key, safe[key]); });
    return url.toString();
  }

  function decorateCheckoutUrl(href) {
    var url = new URL(href, window.location.href);
    if (url.protocol !== 'https:' || url.hostname !== 'secondactlabs.lemonsqueezy.com' || url.username || url.password
      || !/^\/checkout\/buy\/[a-f0-9-]+\/?$/.test(url.pathname)) return href;
    url.search = '';
    url.hash = '';
    var fields = { source: 'website', channel: 'website', surface: 'website', schema: '1' };
    Object.keys(fields).forEach(function (key) { url.searchParams.set('checkout[custom][' + key + ']', fields[key]); });
    return url.toString();
  }

  // Delete the former first/last-page and campaign history without reading it.
  try { window.localStorage.removeItem('gc_attribution_v1'); } catch (_) {}

  window.GenCatalogAttribution = Object.freeze({
    downloadAttribution: downloadAttribution,
    decorateDownloadUrl: decorateDownloadUrl,
    decorateCheckoutUrl: decorateCheckoutUrl,
    checkoutSources: Object.freeze(CHECKOUT_SOURCES)
  });

  function decorateLinks() {
    document.querySelectorAll('a[href*="lemonsqueezy.com/checkout"]').forEach(function (link) {
      link.href = decorateCheckoutUrl(link.href);
      link.rel = 'noreferrer noopener';
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', decorateLinks);
  else decorateLinks();
  document.addEventListener('click', function (event) {
    var link = event.target && event.target.closest ? event.target.closest('a') : null;
    if (link && link.href.indexOf('secondactlabs.lemonsqueezy.com/checkout/') !== -1) {
      link.href = decorateCheckoutUrl(link.href);
      link.rel = 'noreferrer noopener';
    }
  });
})();
