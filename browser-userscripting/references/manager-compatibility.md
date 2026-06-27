# Manager Compatibility

## Manager Overview

| Feature | Tampermonkey | Violentmonkey | Greasemonkey |
|---------|-------------|---------------|-------------|
| Primary API | GM_* (callback) | GM_* + GM.* | GM.* (async only) |
| Browser support | Chrome, Firefox, Edge, Opera, Safari | Firefox, Chrome*, Edge | Firefox only |
| License | Proprietary (source-viewable) | MIT (open source) | MIT (open source) |
| MV3 status | Migrated | NOT migrated | N/A (Firefox) |
| Active development | Yes | Yes (Firefox focus) | Minimal |

*Violentmonkey: Broken on Chrome as of mid-2025 due to MV3 non-migration. Works on Firefox and Brave.

## Manifest V3 Impact (as of early 2026)

Chrome's transition to Manifest V3 significantly affects userscript managers:

- **Tampermonkey**: Has migrated to MV3. Requires users to enable Developer Mode in chrome://extensions for userscript execution. Fully functional with this setting.
- **Violentmonkey**: Has NOT migrated. Extension disabled on Chrome and most Chromium browsers. Continues to work on Firefox (which handles MV3 differently) and Brave (which still allows MV2).
- **Greasemonkey**: Firefox-only, unaffected by Chrome's changes.

**Pragmatic recommendation:** Target Tampermonkey as primary for Chrome users. Violentmonkey remains viable for Firefox users. Test in both when possible.

Note: This landscape is actively evolving. Check current manager release notes for the latest MV3 status.

## API Style Compatibility

### GM_* (Callback/Synchronous)

```javascript
const value = GM_getValue('key', 'default');
GM_setValue('key', 'newValue');

GM_xmlhttpRequest({
  method: 'GET',
  url: 'https://api.example.com/data',
  onload: function(response) { /* callback */ }
});
```

- Works in: Tampermonkey, Violentmonkey
- Does NOT work in: Greasemonkey 4+

### GM.* (Promise/Async)

```javascript
const value = await GM.getValue('key', 'default');
await GM.setValue('key', 'newValue');

const response = await GM.xmlHttpRequest({
  method: 'GET',
  url: 'https://api.example.com/data'
});
```

- Works in: Greasemonkey 4+, Violentmonkey (since v2.12.0)
- Tampermonkey: Supported but less commonly used

### Recommendation

Use `GM_*` style for maximum compatibility across Tampermonkey and Violentmonkey (the two actively maintained managers with broad browser support). Greasemonkey 4's async-only API and Firefox-only scope make it a niche target.

If Greasemonkey compatibility is required, use a polyfill:

```
// @require https://greasemonkey.github.io/gm4-polyfill/gm4-polyfill.js
```

This provides GM.* wrappers around GM_* functions.

### Detecting API Availability

```javascript
if (typeof GM_getValue === 'function') {
  // GM_* API available (Tampermonkey, Violentmonkey)
  const value = GM_getValue('key', 'default');
} else if (typeof GM !== 'undefined' && typeof GM.getValue === 'function') {
  // GM.* API available (Greasemonkey 4)
  GM.getValue('key', 'default').then(value => { /* use value */ });
}
```

## Feature Differences

### Storage

| Feature | TM | VM | GM |
|---------|----|----|-----|
| GM_getValue/setValue | Yes | Yes | No (use GM.*) |
| GM_getValues/setValues (batch) | v5.3+ | v2.19.1+ | No |
| GM_addValueChangeListener | Yes | Yes | No |
| Cross-tab value sync | Yes | Yes | Limited |

#### Batch Storage Operations

Tampermonkey 5.3+ and Violentmonkey 2.19.1+ support batch operations:

```javascript
// Get multiple values at once
const values = GM_getValues(['key1', 'key2', 'key3']);
// Returns: { key1: value1, key2: value2, key3: value3 }

// Set multiple values at once
GM_setValues({
  key1: 'value1',
  key2: 'value2',
  key3: 'value3'
});
```

Not available in Greasemonkey.

#### Value Change Listeners

Tampermonkey and Violentmonkey support cross-tab synchronization:

```javascript
const listenerId = GM_addValueChangeListener('key', function(name, oldValue, newValue, remote) {
  console.log(`${name} changed from ${oldValue} to ${newValue}`);
  console.log(`Change was ${remote ? 'remote' : 'local'}`);
});

// Later, remove listener:
GM_removeValueChangeListener(listenerId);
```

Not available in Greasemonkey.

### Network

| Feature | TM | VM | GM |
|---------|----|----|-----|
| GM_xmlhttpRequest | Yes | Yes | No (use GM.*) |
| @connect required | Yes | Yes | No (different model) |
| Cookies sent by default | Yes | Yes | Same-origin only |
| GM_download | Yes | v2.9.5+ | No |

#### Greasemonkey Network API

Greasemonkey 4 uses `GM.xmlHttpRequest` (async):

```javascript
const response = await GM.xmlHttpRequest({
  method: 'GET',
  url: 'https://api.example.com/data'
});
```

Does not require @connect declarations. Permissions handled differently.

### DOM

| Feature | TM | VM | GM |
|---------|----|----|-----|
| GM_addStyle | Yes | Yes | No (use GM.*) |
| GM_addElement | v4.11+ | v2.13.1+ | No |

#### Greasemonkey DOM API

Greasemonkey 4 does not provide GM_addStyle or GM_addElement. Use manual DOM injection:

```javascript
const style = document.createElement('style');
style.textContent = '.ad { display: none; }';
document.head.appendChild(style);
```

### Execution Context

| Feature | TM | VM | GM |
|---------|----|----|-----|
| @sandbox (raw/JS/DOM) | Yes | No | No |
| @inject-into (page/content/auto) | No | Yes | No |
| @run-at document-body | Yes | Yes | No |
| @run-at context-menu | Yes | No | No |
| window.onurlchange | Yes | No | No |

#### Tampermonkey @sandbox

Controls the type of sandbox:

```
// @sandbox JavaScript
```

- `JavaScript`: Isolated from page scripts, full access to GM_* APIs
- `raw`: Direct page context (like @grant none but with GM_* APIs)
- `DOM`: DOM-level isolation

Rarely needed. Default is `JavaScript`.

#### Violentmonkey @inject-into

Controls execution context:

```
// @inject-into page
```

- `page`: Inject into page context (access unsafeWindow directly as `window`)
- `content`: Isolated content script context (default)
- `auto`: Try `page`, fall back to `content`

Use `page` when accessing page-level libraries. Use `content` for security.

#### Tampermonkey window.onurlchange

Detects URL changes in SPAs without polling:

```javascript
// Only works in Tampermonkey
if (window.onurlchange === null) {
  window.addEventListener('urlchange', (info) => {
    console.log('URL changed to:', info.url);
  });
}
```

Not available in Violentmonkey or Greasemonkey. Use MutationObserver or polling as fallback.

### UI

| Feature | TM | VM | GM |
|---------|----|----|-----|
| GM_registerMenuCommand | Yes | Yes | No (use GM.*) |
| GM_notification | Yes | Yes | No (use GM.*) |
| GM_cookie | Yes | No | No |
| @antifeature | Yes | No | No |

#### Tampermonkey GM_cookie

Access and modify cookies across domains:

```javascript
// @grant GM_cookie

GM_cookie.list({ url: 'https://example.com' }, function(cookies) {
  console.log(cookies);
});

GM_cookie.set({
  url: 'https://example.com',
  name: 'sessionId',
  value: 'abc123',
  domain: '.example.com',
  path: '/',
  secure: true
}, function() {
  console.log('Cookie set');
});
```

Violentmonkey and Greasemonkey do not support GM_cookie.

#### Greasemonkey Menu Commands

Greasemonkey 4 uses `GM.registerMenuCommand` (async return):

```javascript
GM.registerMenuCommand('Do Something', async function() {
  // Async function
});
```

### Clipboard

| Feature | TM | VM | GM |
|---------|----|----|-----|
| GM_setClipboard | Yes | Yes | No (use GM.*) |

Greasemonkey 4 uses `GM.setClipboard`:

```javascript
await GM.setClipboard('text to copy');
```

## Writing Cross-Manager Scripts

To write scripts that work across Tampermonkey and Violentmonkey:

1. Use `GM_*` API style (not GM.*)
2. Use `@match` for URL matching (not @include with regex)
3. Stick to widely supported features: GM_getValue/setValue, GM_addStyle, GM_xmlhttpRequest, GM_registerMenuCommand, GM_notification, GM_openInTab
4. Avoid manager-specific features: window.onurlchange (TM only), @inject-into (VM only), GM_cookie (TM only)
5. Use feature detection for optional enhancements:

```javascript
if (typeof GM_addElement === 'function') {
  GM_addElement('style', { textContent: css });
} else {
  GM_addStyle(css);
}

if (typeof GM_getValues === 'function') {
  // Use batch operation
  const values = GM_getValues(['key1', 'key2']);
} else {
  // Fallback to individual calls
  const key1 = GM_getValue('key1');
  const key2 = GM_getValue('key2');
}
```

### Cross-Manager Template

```javascript
// ==UserScript==
// @name         Cross-Manager Script
// @match        https://example.com/*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_addStyle
// @grant        GM_xmlhttpRequest
// @grant        GM_registerMenuCommand
// @connect      api.example.com
// ==/UserScript==

(function() {
  'use strict';

  // Core logic using widely-supported APIs
  GM_addStyle('.ad { display: none; }');

  const setting = GM_getValue('setting', 'default');

  GM_registerMenuCommand('Toggle Feature', function() {
    const newValue = !GM_getValue('enabled', false);
    GM_setValue('enabled', newValue);
  });

  GM_xmlhttpRequest({
    method: 'GET',
    url: 'https://api.example.com/data',
    onload: function(response) {
      console.log(response.responseText);
    }
  });
})();
```

## @grant Behavior Differences

With `@grant none`:
- All managers: Script runs in page context, no sandbox, no GM_* APIs
- Behavior is consistent

With specific grants:
- **Tampermonkey**: Scripts run in a sandbox. @sandbox controls sandbox type.
- **Violentmonkey**: Scripts run in sandbox by default. @inject-into controls context. `page` mode: direct page access. `content` mode: isolated world. `auto`: try page, fall back to content.
- **Greasemonkey**: Always sandboxed when using GM.* APIs.

### Testing @grant Behavior

```javascript
console.log('typeof unsafeWindow:', typeof unsafeWindow);
console.log('window === unsafeWindow:', window === unsafeWindow);

// With @grant none:
// - TM: unsafeWindow is undefined, window is page window
// - VM: unsafeWindow is undefined, window is page window
// - GM: unsafeWindow is undefined, window is page window

// With @grant GM_getValue (or any grant):
// - TM: unsafeWindow exists, window !== unsafeWindow
// - VM: unsafeWindow exists, window !== unsafeWindow (unless @inject-into page)
// - GM: unsafeWindow exists, window !== unsafeWindow
```

## Browser-Specific Notes

- **Chrome**: Requires Developer Mode for Tampermonkey. Violentmonkey non-functional.
- **Firefox**: All three managers work. Greasemonkey is Firefox-exclusive. Best compatibility overall.
- **Brave**: Still allows MV2 extensions. Violentmonkey works.
- **Edge**: Follows Chrome's Chromium base. Same MV3 requirements as Chrome.
- **Safari**: Out of scope for this skill. Different ecosystem (Userscripts app).

### Testing Checklist

For maximum compatibility, test scripts in:

1. Tampermonkey on Chrome (MV3 environment, Developer Mode)
2. Violentmonkey on Firefox (most permissive environment)
3. Tampermonkey on Firefox (cross-check)

Avoid testing only in one browser/manager combination.

## Version-Specific Features

Always check manager versions before using newer features:

```javascript
// Check if GM_addElement is available (TM 4.11+, VM 2.13.1+)
if (typeof GM_addElement === 'function') {
  GM_addElement('style', { textContent: css });
} else {
  // Fallback for older versions
  GM_addStyle(css);
}

// Check for batch operations (TM 5.3+, VM 2.19.1+)
if (typeof GM_getValues === 'function') {
  const values = GM_getValues(['key1', 'key2']);
} else {
  const values = {
    key1: GM_getValue('key1'),
    key2: GM_getValue('key2')
  };
}
```

### GM_info for Version Detection

```javascript
const info = GM_info;
console.log('Script handler:', info.scriptHandler); // "Tampermonkey", "Violentmonkey", etc.
console.log('Version:', info.version);

if (info.scriptHandler === 'Tampermonkey' && parseFloat(info.version) >= 4.11) {
  // Use Tampermonkey 4.11+ features
}
```

## Migration Guides

### From Greasemonkey to Tampermonkey/Violentmonkey

Replace async GM.* calls with callback GM_* calls:

```javascript
// Greasemonkey 4:
const value = await GM.getValue('key', 'default');
await GM.setValue('key', 'newValue');

// Tampermonkey/Violentmonkey:
const value = GM_getValue('key', 'default');
GM_setValue('key', 'newValue');
```

Add @grant declarations:

```
// @grant GM_getValue
// @grant GM_setValue
```

### From GM_* to GM.* (for Greasemonkey)

Use the polyfill:

```
// @require https://greasemonkey.github.io/gm4-polyfill/gm4-polyfill.js
```

Or manually convert:

```javascript
// Original (TM/VM):
GM_addStyle('.ad { display: none; }');

// Manual DOM injection (GM):
const style = document.createElement('style');
style.textContent = '.ad { display: none; }';
document.head.appendChild(style);
```
