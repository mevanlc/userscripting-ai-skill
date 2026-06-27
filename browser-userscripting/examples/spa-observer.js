// ==UserScript==
// @name        YouTube Custom UI
// @namespace   https://github.com/example/userscripts
// @version     1.0.0
// @description Add a custom button to YouTube video pages that appears on SPA navigation
// @author      Example Author
// @match       *://www.youtube.com/*
// @grant       GM_addStyle
// @run-at      document-idle
// @noframes
// ==/UserScript==

(function() {
  'use strict';

  const BUTTON_ID = 'yt-custom-button';

  // Inject styles once
  GM_addStyle(`
    #${BUTTON_ID} {
      background: #065fd4;
      color: #fff;
      border: none;
      padding: 8px 16px;
      border-radius: 18px;
      font-size: 14px;
      cursor: pointer;
      margin-left: 8px;
    }
    #${BUTTON_ID}:hover {
      background: #0556bf;
    }
  `);

  let currentCleanup = null;
  let currentUrl = location.href;

  /**
   * Initialize the script for the current page.
   * Called on first load and after each SPA navigation.
   */
  function initForPage() {
    // Clean up previous instance
    if (currentCleanup) {
      currentCleanup();
      currentCleanup = null;
    }

    // Only act on video watch pages
    if (!location.pathname.startsWith('/watch')) {
      return;
    }

    // Wait for the video actions bar to appear
    waitForElement('#actions #top-level-buttons-computed', (container) => {
      // Guard against duplicate injection
      if (document.getElementById(BUTTON_ID)) return;

      const button = document.createElement('button');
      button.id = BUTTON_ID;
      button.textContent = 'Custom Action';
      button.addEventListener('click', handleClick);
      container.appendChild(button);

      // Register cleanup for this instance
      currentCleanup = () => {
        button.removeEventListener('click', handleClick);
        button.remove();
      };
    });
  }

  function handleClick() {
    const videoTitle = document.querySelector(
      'yt-formatted-string.ytd-watch-metadata'
    )?.textContent;
    console.log('[YouTube Custom UI] Button clicked for:', videoTitle);
  }

  /**
   * Wait for an element to appear in the DOM using MutationObserver.
   * Disconnects automatically once the element is found.
   */
  function waitForElement(selector, callback) {
    const existing = document.querySelector(selector);
    if (existing) {
      callback(existing);
      return;
    }

    const observer = new MutationObserver((_mutations, obs) => {
      const el = document.querySelector(selector);
      if (el) {
        obs.disconnect();
        callback(el);
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });
  }

  /**
   * Detect SPA navigation by polling for URL changes.
   * YouTube uses pushState for navigation — popstate alone is insufficient.
   */
  function watchForNavigation() {
    const CHECK_INTERVAL_MS = 1000;

    setInterval(() => {
      if (location.href !== currentUrl) {
        currentUrl = location.href;
        initForPage();
      }
    }, CHECK_INTERVAL_MS);

    // Also catch back/forward navigation
    window.addEventListener('popstate', () => {
      if (location.href !== currentUrl) {
        currentUrl = location.href;
        initForPage();
      }
    });
  }

  // Run on initial load
  initForPage();

  // Watch for SPA navigations
  watchForNavigation();
})();
