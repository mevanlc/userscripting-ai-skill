# GM_* API Reference

## API Style Note

Two API styles exist:
- `GM_*` (callback/synchronous): Works in Tampermonkey and Violentmonkey. Use this for maximum compatibility.
- `GM.*` (Promise-based): Greasemonkey 4 primary, also available in Violentmonkey since v2.12.0. Every GM_* function has a GM.* equivalent (e.g., GM.getValue instead of GM_getValue).

This reference documents the GM_* style. For GM.* equivalents, replace underscores with dots and use camelCase (GM_xmlhttpRequest → GM.xmlHttpRequest). GM.* functions return Promises.

## Storage

### GM_getValue(key, defaultValue)

- Grant: `@grant GM_getValue`
- Returns stored value or defaultValue if key doesn't exist
- Values are JSON-serializable (strings, numbers, booleans, objects, arrays)
- Storage is script-specific and persists across page loads and browser sessions
- Use defaultValue parameter to avoid null/undefined checks

Example:
```javascript
// Simple retrieval
const count = GM_getValue('clickCount', 0);

// Object storage
const settings = GM_getValue('settings', { theme: 'dark', enabled: true });
```

### GM_setValue(key, value)

- Grant: `@grant GM_setValue`
- Store data persistently across page loads and sessions
- Values must be JSON-serializable
- Overwrites existing value for the same key
- Storage quota varies by manager (typically several MB)

Example:
```javascript
GM_setValue('lastVisit', Date.now());
GM_setValue('preferences', { notifications: true, autoplay: false });
```

### GM_deleteValue(key)

- Grant: `@grant GM_deleteValue`
- Remove a stored key-value pair
- Silent if key doesn't exist

Example:
```javascript
GM_deleteValue('temporaryData');
```

### GM_listValues()

- Grant: `@grant GM_listValues`
- Returns array of all stored key names
- Use to iterate over all stored data or check key existence

Example:
```javascript
const keys = GM_listValues();
keys.forEach(key => {
  console.log(key, GM_getValue(key));
});
```

### GM_getValues(keysOrDefaults)

- Grant: `@grant GM_getValues`
- Batch retrieval for performance
- Pass array of keys or object with defaults
- Tampermonkey v5.3+, Violentmonkey v2.19.1+

Example:
```javascript
// With defaults
const values = GM_getValues({ count: 0, enabled: true, name: 'Guest' });

// With array
const values = GM_getValues(['key1', 'key2', 'key3']);
```

### GM_setValues(object)

- Grant: `@grant GM_setValues`
- Batch storage for performance
- Pass object of key-value pairs
- Tampermonkey v5.3+, Violentmonkey v2.19.1+

Example:
```javascript
GM_setValues({
  lastSync: Date.now(),
  itemCount: 42,
  preferences: { theme: 'light' }
});
```

### GM_deleteValues(keysArray)

- Grant: `@grant GM_deleteValues`
- Batch deletion for performance
- Tampermonkey v5.3+, Violentmonkey v2.19.1+

Example:
```javascript
GM_deleteValues(['tempData1', 'tempData2', 'cache']);
```

### GM_addValueChangeListener(key, callback)

- Grant: `@grant GM_addValueChangeListener`
- Monitor changes to specific storage key
- callback receives: `(key, oldValue, newValue, remote)`
- `remote` is true when change came from another tab
- Use for cross-tab communication and state synchronization
- Returns listener ID for cleanup

Example:
```javascript
const listenerId = GM_addValueChangeListener('settings', (key, oldVal, newVal, remote) => {
  if (remote) {
    console.log('Settings updated in another tab:', newVal);
    applySettings(newVal);
  }
});
```

### GM_removeValueChangeListener(listenerId)

- Grant: `@grant GM_removeValueChangeListener`
- Remove listener when no longer needed
- Prevents memory leaks in long-running scripts

Example:
```javascript
GM_removeValueChangeListener(listenerId);
```

## DOM Manipulation

### GM_addStyle(css)

- Grant: `@grant GM_addStyle`
- Inject CSS stylesheet into page
- Returns the created `<style>` element
- Bypasses Content Security Policy restrictions
- Styles persist across dynamic DOM changes
- Injection happens before page render when possible

Example:
```javascript
GM_addStyle(`
  .ad-banner { display: none !important; }
  .custom-widget {
    position: fixed;
    top: 10px;
    right: 10px;
    z-index: 9999;
  }
`);

// Store reference for later removal
const styleElement = GM_addStyle('.temporary { color: red; }');
// Remove when needed: styleElement.remove();
```

### GM_addElement(tagName, attributes) / GM_addElement(parentNode, tagName, attributes)

- Grant: `@grant GM_addElement`
- Create and inject HTML element into page
- Bypasses CSP for script and style elements
- Two forms: append to document (2-arg) or to specific parent (3-arg)
- attributes object: set any HTML attribute, plus `textContent` for inner text
- Returns the created element
- Tampermonkey 4.11+, Violentmonkey v2.13.1+

Example:
```javascript
// Load external library (bypasses CSP)
GM_addElement('script', {
  src: 'https://example.com/library.js',
  type: 'text/javascript'
});

// Inline script
GM_addElement('script', {
  textContent: 'console.log("Injected!");'
});

// Add to specific parent
const container = document.querySelector('#container');
GM_addElement(container, 'div', {
  id: 'custom-widget',
  class: 'widget',
  textContent: 'Hello World'
});

// Style element
GM_addElement('style', {
  textContent: 'body { background: #f0f0f0; }'
});
```

## Network

### GM_xmlhttpRequest(details)

- Grant: `@grant GM_xmlhttpRequest`
- Also requires `@connect` for each target domain (use `@connect *` for all domains)
- Sends HTTP requests bypassing CORS restrictions
- Executes from extension background context, not page context
- Returns object with `abort()` method
- Use for API calls, fetching external resources, cross-origin requests

details object properties:
- `method`: HTTP method (GET, POST, PUT, DELETE, HEAD, PATCH)
- `url`: Target URL (must match an @connect domain)
- `headers`: Object of request headers
- `data`: Request body (string or FormData for POST/PUT)
- `responseType`: 'text' (default), 'json', 'blob', 'arraybuffer', 'document'
- `timeout`: Milliseconds before timeout
- `anonymous`: Boolean — don't send cookies (Tampermonkey)
- `user`/`password`: Basic auth credentials
- `overrideMimeType`: Override MIME type
- `synchronous`: Boolean — make synchronous request (not recommended)
- Callbacks: `onload`, `onerror`, `ontimeout`, `onprogress`, `onabort`, `onreadystatechange`

Response object (passed to callbacks):
- `status`: HTTP status code
- `statusText`: Status text
- `responseHeaders`: String of response headers
- `response`: Response body (type depends on responseType)
- `responseText`: Response as text
- `responseXML`: Response as XML document (if applicable)
- `finalUrl`: Final URL after redirects
- `readyState`: Current state (for onreadystatechange)

Example:
```javascript
GM_xmlhttpRequest({
  method: 'GET',
  url: 'https://api.example.com/data',
  headers: {
    'User-Agent': 'Custom Script',
    'Accept': 'application/json'
  },
  responseType: 'json',
  timeout: 5000,
  onload: function(response) {
    if (response.status === 200) {
      console.log('Data:', response.response);
    } else {
      console.error('HTTP error:', response.status);
    }
  },
  onerror: function(error) {
    console.error('Request failed:', error);
  },
  ontimeout: function() {
    console.error('Request timed out');
  }
});

// POST with data
GM_xmlhttpRequest({
  method: 'POST',
  url: 'https://api.example.com/submit',
  headers: {
    'Content-Type': 'application/json'
  },
  data: JSON.stringify({ key: 'value' }),
  onload: function(response) {
    console.log('Response:', response.responseText);
  }
});

// Abort long-running request
const request = GM_xmlhttpRequest({
  method: 'GET',
  url: 'https://example.com/large-file',
  onload: (r) => console.log('Done')
});
// Later: request.abort();
```

### GM_download(details) / GM_download(url, name)

- Grant: `@grant GM_download`
- Download file to user's disk
- Bypasses CORS restrictions like GM_xmlhttpRequest
- Triggers browser's download mechanism
- Returns object with `abort()` method

details object:
- `url`: File URL (required)
- `name`: Filename (required)
- `headers`: Request headers object
- `saveAs`: Boolean — show save dialog (default: false)
- `conflictAction`: 'uniquify' (default), 'overwrite', 'prompt'
- `timeout`: Timeout in milliseconds
- Callbacks: `onload`, `onerror`, `onprogress`, `ontimeout`

Error types in onerror:
- `not_enabled`: Download feature disabled
- `not_whitelisted`: Domain not in @connect
- `not_permitted`: Browser permission denied
- `not_supported`: File type/feature not supported
- `not_succeeded`: Download failed

Example:
```javascript
// Simple form
GM_download('https://example.com/file.pdf', 'document.pdf');

// Full control
GM_download({
  url: 'https://example.com/data.json',
  name: 'backup-' + Date.now() + '.json',
  saveAs: true,
  headers: { 'Authorization': 'Bearer token' },
  onload: function() {
    console.log('Download complete');
  },
  onerror: function(error) {
    console.error('Download failed:', error.error);
  },
  onprogress: function(progress) {
    const percent = (progress.loaded / progress.total * 100).toFixed(0);
    console.log('Downloaded:', percent + '%');
  }
});
```

## UI and Interaction

### GM_registerMenuCommand(name, callback, options)

- Grant: `@grant GM_registerMenuCommand`
- Add item to the userscript manager's popup menu for this script
- Menu appears in browser toolbar extension popup
- Returns command ID for later removal
- Useful for toggles, settings, actions

options (Tampermonkey):
- `id`: Command ID (for updating existing command)
- `accessKey`: Keyboard shortcut character
- `autoClose`: Boolean — close menu after click (default: true)
- `title`: Tooltip text

options (Violentmonkey):
- `id`: Command ID
- `icon`: Icon URL or data URL
- `title`: Tooltip text
- `autoClose`: Boolean

Example:
```javascript
let enabled = GM_getValue('enabled', true);

const cmdId = GM_registerMenuCommand('Toggle Feature', function() {
  enabled = !enabled;
  GM_setValue('enabled', enabled);
  console.log('Feature', enabled ? 'enabled' : 'disabled');
}, {
  title: 'Enable or disable the main feature',
  accessKey: 't'
});

// Update menu to show state
GM_registerMenuCommand(enabled ? '✓ Feature Enabled' : 'Feature Disabled', toggleFeature, {
  id: 'toggle-cmd'
});
```

### GM_unregisterMenuCommand(commandId)

- Grant: `@grant GM_unregisterMenuCommand`
- Remove a previously registered menu command
- Use when command is no longer relevant

Example:
```javascript
GM_unregisterMenuCommand(cmdId);
```

### GM_notification(details) / GM_notification(text, title, image, onclick)

- Grant: `@grant GM_notification`
- Show desktop notification
- Requires user permission in browser settings
- Returns notification object or undefined

details object:
- `text`: Notification body (required)
- `title`: Notification title
- `image`: Icon image URL
- `tag`: Identifier to reuse/replace notification with same tag
- `silent`: Boolean — no notification sound
- `timeout`: Auto-close after milliseconds
- `url`: URL to open on click (Violentmonkey)
- `highlight`: Boolean — highlight tab (Tampermonkey)
- Callbacks: `onclick`, `ondone`

Example:
```javascript
// Simple form
GM_notification('Task completed!', 'Success');

// Full control
GM_notification({
  text: 'New message from user123',
  title: 'Chat Notification',
  image: 'https://example.com/icon.png',
  timeout: 5000,
  tag: 'chat-notification',
  onclick: function() {
    window.focus();
    document.querySelector('#chat').scrollIntoView();
  },
  ondone: function() {
    console.log('Notification closed');
  }
});

// Replace existing notification with same tag
GM_notification({
  text: 'Upload progress: 50%',
  tag: 'upload-status'
});
```

### GM_openInTab(url, options)

- Grant: `@grant GM_openInTab`
- Open new browser tab
- Returns object with `close()`, `onclose` callback, `closed` property
- Use for external links, multi-page workflows

options object:
- `active`: Boolean — make tab active (default: true)
- `insert`: Boolean — insert next to current tab (default: false)
- `setParent`: Boolean — mark as child of current tab (default: false)
- `incognito`: Boolean — open in incognito/private window

Short form: `GM_openInTab(url, loadInBackground)` where second arg is boolean (true = background)

Example:
```javascript
// Open in background
const tab = GM_openInTab('https://example.com', true);

// Full control
const tab = GM_openInTab('https://example.com', {
  active: false,
  insert: true,
  setParent: true
});

// Close tab later
tab.onclose = function() {
  console.log('Tab closed');
};
setTimeout(() => tab.close(), 5000);

// Check if closed
if (!tab.closed) {
  tab.close();
}
```

### GM_setClipboard(data, type)

- Grant: `@grant GM_setClipboard`
- Copy data to clipboard
- Works without user gesture (unlike document.execCommand)
- Silent operation, consider notifying user

type parameter:
- `'text/plain'`: Plain text (default)
- `'text/html'`: HTML content

Example:
```javascript
// Copy text
GM_setClipboard('Text to copy');

// Copy HTML
GM_setClipboard('<strong>Bold text</strong>', 'text/html');

// Useful with notification
button.addEventListener('click', function() {
  GM_setClipboard(codeBlock.textContent);
  GM_notification('Code copied to clipboard');
});
```

## Resource Access

### GM_getResourceText(name)

- Grant: `@grant GM_getResourceText`
- Retrieve text content of a @resource by its declared name
- Use for CSS files, JSON data, text templates
- Resources bundled with script, loaded at install time
- Faster than fetching via GM_xmlhttpRequest

Example:
```javascript
// @resource styles https://example.com/styles.css
// @resource config https://example.com/config.json
// @grant GM_getResourceText

const css = GM_getResourceText('styles');
GM_addStyle(css);

const configJson = GM_getResourceText('config');
const config = JSON.parse(configJson);
```

### GM_getResourceURL(name)

- Grant: `@grant GM_getResourceURL`
- Get a URL pointing to a @resource
- Returns blob: URL (Violentmonkey) or data: URL
- Use for images, fonts, other binary resources
- Use in src, href attributes

Example:
```javascript
// @resource logo https://example.com/logo.png
// @resource font https://example.com/font.woff2
// @grant GM_getResourceURL

const logoUrl = GM_getResourceURL('logo');
const img = document.createElement('img');
img.src = logoUrl;
document.body.appendChild(img);

// Font in CSS
const fontUrl = GM_getResourceURL('font');
GM_addStyle(`
  @font-face {
    font-family: 'CustomFont';
    src: url('${fontUrl}') format('woff2');
  }
  body { font-family: 'CustomFont', sans-serif; }
`);
```

## Information

### GM_info

- Always available (no @grant needed)
- Read-only object containing script and runtime metadata
- Use for version checking, conditional logic, debugging

Properties:
- `script.name`: Script name from @name
- `script.version`: Script version from @version
- `script.description`: Description from @description
- `script.author`: Author from @author
- `script.matches`: Array of @match patterns
- `script.includes`: Array of @include patterns
- `script.excludes`: Array of @exclude patterns
- `script.grants`: Array of @grant declarations
- `script.resources`: Object mapping resource names to URLs
- `scriptHandler`: Manager name ('Tampermonkey', 'Violentmonkey', 'Greasemonkey')
- `version`: Manager version string
- `isIncognito`: Boolean — running in incognito/private mode
- `platform` (Violentmonkey): `arch`, `browserName`, `browserVersion`, `os`

Example:
```javascript
console.log('Script:', GM_info.script.name, 'v' + GM_info.script.version);
console.log('Manager:', GM_info.scriptHandler, GM_info.version);

if (GM_info.isIncognito) {
  console.log('Running in incognito mode');
}

// Version-specific features
if (GM_info.scriptHandler === 'Tampermonkey') {
  // Use TM-specific features
}

// Check grants
if (GM_info.script.grants.includes('GM_xmlhttpRequest')) {
  // Network access available
}
```

## Tab Management

### GM_getTab(callback)

- Grant: `@grant GM_getTab`
- Retrieve persistent object for current tab
- Object persists across page navigations within the tab
- Use for tab-specific state

Example:
```javascript
GM_getTab(function(tab) {
  console.log('Tab object:', tab);
  tab.visitCount = (tab.visitCount || 0) + 1;
  GM_saveTab(tab);
});
```

### GM_saveTab(tabObj)

- Grant: `@grant GM_saveTab`
- Save modified tab object
- Call after modifying tab data from GM_getTab

Example:
```javascript
GM_getTab(function(tab) {
  tab.lastVisit = Date.now();
  tab.scrollPosition = window.scrollY;
  GM_saveTab(tab);
});
```

### GM_getTabs(callback)

- Grant: `@grant GM_getTabs`
- Retrieve all saved tab objects across all tabs
- Use for cross-tab coordination and communication
- Returns object mapping tab IDs to tab objects

Example:
```javascript
GM_getTabs(function(tabs) {
  console.log('Open tabs:', Object.keys(tabs).length);
  Object.values(tabs).forEach(tab => {
    console.log('Tab data:', tab);
  });

  // Find tabs with specific state
  const activeTabs = Object.values(tabs).filter(t => t.active);
});
```

## Special Objects

### unsafeWindow

- Grant: `@grant unsafeWindow`
- Direct reference to the page's actual window object
- Bypasses userscript sandbox isolation
- Use to access page-level JavaScript variables, libraries, functions
- Security risk: page scripts can manipulate values accessed through unsafeWindow
- Consult references/security.md before using

Example:
```javascript
// Access page variable
const pageData = unsafeWindow.appData;

// Call page function
unsafeWindow.showNotification('Hello from userscript');

// Access page library
if (unsafeWindow.jQuery) {
  const $ = unsafeWindow.jQuery;
  $('button').click(handleClick);
}

// DANGER: Don't trust data from unsafeWindow
// Page can modify it maliciously
```

### window.onurlchange

- Grant: `@grant window.onurlchange`
- Tampermonkey only
- Listen for URL changes in SPAs without polling
- Fires on pushState, replaceState, and popstate events
- See references/spa-and-dynamic-dom.md for SPA patterns

Example:
```javascript
if (window.onurlchange === null) {
  // Feature supported
  window.addEventListener('urlchange', function(info) {
    console.log('URL changed from', info.oldURL, 'to', info.newURL);
    handlePageChange();
  });
}
```

### window.close / window.focus

- Grant: `@grant window.close` / `@grant window.focus`
- Close current tab or bring it to focus
- Use with caution — unexpected tab closure frustrates users

Example:
```javascript
// @grant window.close
if (shouldCloseTab()) {
  window.close();
}

// @grant window.focus
button.addEventListener('click', function() {
  window.focus();
});
```

## Cookie Management (Tampermonkey)

### GM_cookie.list(details, callback)

- Grant: `@grant GM_cookie`
- Query cookies by url, domain, name, path
- Tampermonkey-specific
- Requires additional browser permissions

details object:
- `url`: URL to match cookies against
- `domain`: Cookie domain
- `name`: Cookie name
- `path`: Cookie path

Example:
```javascript
GM_cookie.list({ url: 'https://example.com' }, function(cookies, error) {
  if (!error) {
    cookies.forEach(cookie => {
      console.log(cookie.name, cookie.value);
    });
  }
});
```

### GM_cookie.set(details, callback)

- Set or update cookie
- details: `url`, `name`, `value`, `domain`, `path`, `secure`, `httpOnly`, `expirationDate`, `sameSite`

Example:
```javascript
GM_cookie.set({
  url: 'https://example.com',
  name: 'session',
  value: 'abc123',
  expirationDate: Date.now() / 1000 + 3600,
  secure: true,
  sameSite: 'strict'
}, function(error) {
  if (!error) {
    console.log('Cookie set');
  }
});
```

### GM_cookie.delete(details, callback)

- Delete cookie by name and url

Example:
```javascript
GM_cookie.delete({
  url: 'https://example.com',
  name: 'session'
}, function(error) {
  if (!error) {
    console.log('Cookie deleted');
  }
});
```

## GM.* Async Equivalents

All GM_* functions have Promise-based GM.* equivalents for Greasemonkey 4 compatibility. Violentmonkey supports both styles since v2.12.0.

Key differences:
- Replace underscore with dot: `GM_getValue` → `GM.getValue`
- Returns Promise instead of using callbacks
- Some naming variations (see table below)

| GM_* (Callback) | GM.* (Promise) | Notes |
|---|---|---|
| GM_getValue | GM.getValue | Returns Promise |
| GM_setValue | GM.setValue | Returns Promise |
| GM_deleteValue | GM.deleteValue | Returns Promise |
| GM_listValues | GM.listValues | Returns Promise |
| GM_xmlhttpRequest | GM.xmlHttpRequest | Note capitalization: xmlHttp |
| GM_getResourceURL | GM.getResourceUrl | Note lowercase 'url' |
| GM_addStyle | GM.addStyle | Returns Promise in VM |
| GM_notification | GM.notification | Returns Promise |
| GM_openInTab | GM.openInTab | Sync in VM |
| GM_registerMenuCommand | GM.registerMenuCommand | Sync in VM |
| GM_setClipboard | GM.setClipboard | Sync in VM |

Example conversion:
```javascript
// GM_* style (callback)
GM_getValue('key', 'default'); // returns value immediately
GM_setValue('key', 'value'); // sets immediately

GM_xmlhttpRequest({
  method: 'GET',
  url: 'https://api.example.com',
  onload: function(response) {
    console.log(response.responseText);
  }
});

// GM.* style (Promise)
GM.getValue('key', 'default').then(value => {
  console.log(value);
});

await GM.setValue('key', 'value');

// xmlHttpRequest returns Promise-like object
GM.xmlHttpRequest({
  method: 'GET',
  url: 'https://api.example.com'
}).then(response => {
  console.log(response.responseText);
});
```

For maximum cross-manager compatibility, use the GM_* style. Use GM.* style when targeting modern userscript managers or when async/await syntax improves code readability.
