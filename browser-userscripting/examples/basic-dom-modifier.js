// ==UserScript==
// @name        Clean Example.com
// @namespace   https://github.com/example/userscripts
// @version     1.0.0
// @description Hide distracting elements and apply custom styles on example.com
// @author      Example Author
// @match       *://www.example.com/*
// @grant       GM_addStyle
// @run-at      document-idle
// @noframes
// ==/UserScript==

(function() {
  'use strict';

  // Hide unwanted elements
  GM_addStyle(`
    .ad-banner,
    .newsletter-popup,
    .cookie-notice,
    #sidebar-promotions {
      display: none !important;
    }
  `);

  // Improve readability
  GM_addStyle(`
    article {
      max-width: 720px !important;
      margin: 0 auto !important;
      font-size: 18px !important;
      line-height: 1.6 !important;
    }

    pre, code {
      font-size: 14px !important;
      background: #f5f5f5 !important;
      padding: 2px 4px !important;
      border-radius: 3px !important;
    }
  `);

  // Remove specific elements that can't be hidden with CSS alone
  const elementsToRemove = document.querySelectorAll('[data-ad-slot], .tracking-pixel');
  elementsToRemove.forEach(el => el.remove());

  console.log('[Clean Example.com] Styles applied and elements removed.');
})();
