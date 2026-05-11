// consent.js — POPIA/GDPR cookie consent banner + conditional pixel loading
// Loaded on every page via <script src="/consent.js" defer></script>
//
// Behaviour:
//   - First visit (no choice in localStorage) → banner appears
//   - Accept → save 'accepted', remove banner, load Meta Pixel + Google Ads
//   - Decline → save 'declined', remove banner, no pixels load
//   - Return visit with 'accepted' → load pixels silently, no banner
//   - Return visit with 'declined' → nothing loads, no banner
//
// Reset: window.mwlResetCookieConsent() clears the choice and reloads.

(function () {
  'use strict';

  var META_PIXEL_ID              = '1515869336805703';
  var GOOGLE_ADS_ID              = 'AW-18154488811';
  var CLOUDFLARE_ANALYTICS_TOKEN = '7184d11a8b794c02a6eb6356e4564247';
  var STORAGE_KEY                = 'mwl_consent';

  // Cloudflare Web Analytics — cookieless, no PII, no consent required
  function loadCloudflareAnalytics() {
    var s = document.createElement('script');
    s.defer = true;
    s.src = 'https://static.cloudflareinsights.com/beacon.min.js';
    s.setAttribute('data-cf-beacon', '{"token":"' + CLOUDFLARE_ANALYTICS_TOKEN + '"}');
    document.head.appendChild(s);
  }

  function loadPixels() {
    // Meta Pixel
    !function (f, b, e, v, n, t, s) {
      if (f.fbq) return;
      n = f.fbq = function () { n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments); };
      if (!f._fbq) f._fbq = n;
      n.push = n; n.loaded = !0; n.version = '2.0'; n.queue = [];
      t = b.createElement(e); t.async = !0;
      t.src = v;
      s = b.getElementsByTagName(e)[0];
      s.parentNode.insertBefore(t, s);
    }(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');
    window.fbq('init', META_PIXEL_ID);
    window.fbq('track', 'PageView');

    // Google Ads gtag
    var gtagSrc = document.createElement('script');
    gtagSrc.async = true;
    gtagSrc.src = 'https://www.googletagmanager.com/gtag/js?id=' + GOOGLE_ADS_ID;
    document.head.appendChild(gtagSrc);
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { window.dataLayer.push(arguments); };
    window.gtag('js', new Date());
    window.gtag('config', GOOGLE_ADS_ID);
  }

  function showBanner() {
    var banner = document.createElement('div');
    banner.id = 'mwl-consent-banner';
    banner.innerHTML =
      '<div style="position:fixed;bottom:0;left:0;right:0;background:#111827;border-top:1px solid rgba(255,255,255,0.07);padding:16px 24px;z-index:99999;color:#f1f5f9;font-family:Inter,system-ui,sans-serif;font-size:0.9rem;box-shadow:0 -4px 12px rgba(0,0,0,0.3);">' +
        '<div style="max-width:1100px;margin:0 auto;display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:12px;">' +
          '<p style="margin:0;flex:1;min-width:240px;color:#cbd5e1;line-height:1.5;">' +
            'We use cookies for analytics and advertising. Your choice. ' +
            '<a href="/privacy-policy" style="color:#f59e0b;text-decoration:none;">Privacy Policy</a>' +
          '</p>' +
          '<div style="display:flex;gap:8px;flex-shrink:0;">' +
            '<button id="mwl-consent-decline" type="button" style="background:transparent;color:#94a3b8;border:1px solid rgba(255,255,255,0.15);padding:9px 20px;border-radius:8px;font:inherit;cursor:pointer;">Decline</button>' +
            '<button id="mwl-consent-accept" type="button" style="background:#f59e0b;color:#0a0a0a;border:none;padding:9px 20px;border-radius:8px;font:inherit;font-weight:600;cursor:pointer;">Accept</button>' +
          '</div>' +
        '</div>' +
      '</div>';
    document.body.appendChild(banner);

    document.getElementById('mwl-consent-accept').addEventListener('click', function () {
      localStorage.setItem(STORAGE_KEY, 'accepted');
      banner.remove();
      loadPixels();
    });

    document.getElementById('mwl-consent-decline').addEventListener('click', function () {
      localStorage.setItem(STORAGE_KEY, 'declined');
      banner.remove();
    });
  }

  // Exposed for the privacy policy "change preferences" link
  window.mwlResetCookieConsent = function () {
    localStorage.removeItem(STORAGE_KEY);
    location.reload();
  };

  function init() {
    // Cookieless analytics — loads regardless of consent
    loadCloudflareAnalytics();

    // Advertising trackers — consent-gated
    var consent;
    try { consent = localStorage.getItem(STORAGE_KEY); } catch (e) { consent = null; }

    if (consent === 'accepted') {
      loadPixels();
    } else if (consent === null) {
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', showBanner);
      } else {
        showBanner();
      }
    }
    // 'declined' → load nothing further
  }

  init();
})();
