// ==UserScript==
// @name        Site Enhancer
// @namespace   https://github.com/example/userscripts
// @version     1.0.0
// @description Feature-rich userscript demonstrating menu commands, storage, CSS, and notifications
// @author      Example Author
// @match       *://example.com/*
// @match       *://www.example.com/*
// @grant       GM_addStyle
// @grant       GM_getValue
// @grant       GM_setValue
// @grant       GM_registerMenuCommand
// @grant       GM_unregisterMenuCommand
// @grant       GM_notification
// @run-at      document-idle
// @noframes
// ==/UserScript==

(function() {
  'use strict';

  // --- Configuration with persistent storage ---

  const DEFAULTS = {
    darkMode: false,
    hideAds: true,
    fontSize: 16,
  };

  // Load settings, falling back to defaults
  const settings = {
    darkMode: GM_getValue('darkMode', DEFAULTS.darkMode),
    hideAds: GM_getValue('hideAds', DEFAULTS.hideAds),
    fontSize: GM_getValue('fontSize', DEFAULTS.fontSize),
  };

  // --- CSS Injection ---

  const STYLE_ID = 'site-enhancer-styles';

  function applyStyles() {
    // Remove previous styles
    const existing = document.getElementById(STYLE_ID);
    if (existing) existing.remove();

    let css = '';

    if (settings.hideAds) {
      css += `
        .ad, .advertisement, [data-ad], .sponsored {
          display: none !important;
        }
      `;
    }

    if (settings.darkMode) {
      css += `
        html {
          filter: invert(1) hue-rotate(180deg) !important;
        }
        img, video, canvas, svg {
          filter: invert(1) hue-rotate(180deg) !important;
        }
      `;
    }

    css += `
      body {
        font-size: ${settings.fontSize}px !important;
      }
    `;

    const style = GM_addStyle(css);
    style.id = STYLE_ID;
  }

  // --- Menu Commands ---

  let darkModeCommandId;
  let hideAdsCommandId;
  let fontUpCommandId;
  let fontDownCommandId;
  let resetCommandId;

  function registerMenuCommands() {
    // Unregister existing commands to refresh labels
    if (darkModeCommandId) GM_unregisterMenuCommand(darkModeCommandId);
    if (hideAdsCommandId) GM_unregisterMenuCommand(hideAdsCommandId);
    if (fontUpCommandId) GM_unregisterMenuCommand(fontUpCommandId);
    if (fontDownCommandId) GM_unregisterMenuCommand(fontDownCommandId);
    if (resetCommandId) GM_unregisterMenuCommand(resetCommandId);

    darkModeCommandId = GM_registerMenuCommand(
      `Dark Mode: ${settings.darkMode ? 'ON' : 'OFF'}`,
      toggleDarkMode
    );

    hideAdsCommandId = GM_registerMenuCommand(
      `Hide Ads: ${settings.hideAds ? 'ON' : 'OFF'}`,
      toggleHideAds
    );

    fontUpCommandId = GM_registerMenuCommand(
      `Font Size + (current: ${settings.fontSize}px)`,
      increaseFontSize
    );

    fontDownCommandId = GM_registerMenuCommand(
      `Font Size - (current: ${settings.fontSize}px)`,
      decreaseFontSize
    );

    resetCommandId = GM_registerMenuCommand(
      'Reset All Settings',
      resetSettings
    );
  }

  // --- Toggle Functions ---

  function toggleDarkMode() {
    settings.darkMode = !settings.darkMode;
    GM_setValue('darkMode', settings.darkMode);
    applyStyles();
    registerMenuCommands();
    notify(`Dark mode ${settings.darkMode ? 'enabled' : 'disabled'}`);
  }

  function toggleHideAds() {
    settings.hideAds = !settings.hideAds;
    GM_setValue('hideAds', settings.hideAds);
    applyStyles();
    registerMenuCommands();
    notify(`Ad hiding ${settings.hideAds ? 'enabled' : 'disabled'}`);
  }

  function increaseFontSize() {
    settings.fontSize = Math.min(settings.fontSize + 2, 32);
    GM_setValue('fontSize', settings.fontSize);
    applyStyles();
    registerMenuCommands();
  }

  function decreaseFontSize() {
    settings.fontSize = Math.max(settings.fontSize - 2, 10);
    GM_setValue('fontSize', settings.fontSize);
    applyStyles();
    registerMenuCommands();
  }

  function resetSettings() {
    Object.assign(settings, DEFAULTS);
    GM_setValue('darkMode', DEFAULTS.darkMode);
    GM_setValue('hideAds', DEFAULTS.hideAds);
    GM_setValue('fontSize', DEFAULTS.fontSize);
    applyStyles();
    registerMenuCommands();
    notify('Settings reset to defaults');
  }

  // --- Notifications ---

  function notify(message) {
    GM_notification({
      text: message,
      title: 'Site Enhancer',
      timeout: 3000,
    });
  }

  // --- Initialize ---

  applyStyles();
  registerMenuCommands();

  console.log('[Site Enhancer] Initialized with settings:', settings);
})();
