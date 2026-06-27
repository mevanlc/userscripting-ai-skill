# Security Considerations

## unsafeWindow

`unsafeWindow` provides direct access to the page's actual `window` object, bypassing the userscript sandbox. This is powerful but dangerous.

**Risks:**
- Page scripts can detect and manipulate values on their own window object
- A malicious page could override functions or properties that the userscript reads via unsafeWindow
- Any object retrieved from unsafeWindow is controlled by the page, not the extension

**Guidelines:**
- Only use unsafeWindow when genuinely necessary (accessing page-level libraries, intercepting page functions)
- Never store sensitive data (tokens, credentials) on unsafeWindow
- Validate and copy data retrieved from unsafeWindow before using it in privileged operations
- Prefer reading DOM attributes/elements over accessing page JS objects when possible

### Safe unsafeWindow Usage

```javascript
// UNSAFE: Direct usage of page object
const pageData = unsafeWindow.myLibrary.getData();
GM_xmlhttpRequest({ url: pageData.url }); // Page can manipulate this!

// SAFER: Copy and validate
const rawUrl = unsafeWindow.myLibrary.getData().url;
if (typeof rawUrl === 'string' && rawUrl.startsWith('https://trusted.com/')) {
  GM_xmlhttpRequest({ url: rawUrl });
}

// SAFEST: Extract primitives only, deep copy objects
const pageConfig = JSON.parse(JSON.stringify(unsafeWindow.appConfig));
```

### Detecting Page Manipulation

```javascript
// Page could override this function
if (typeof unsafeWindow.jQuery === 'function') {
  // Verify it's the real jQuery, not a malicious replacement
  const jqVersion = unsafeWindow.jQuery.fn.jquery;
  if (typeof jqVersion === 'string' && /^\d+\.\d+\.\d+$/.test(jqVersion)) {
    // More confident it's genuine
  }
}
```

## eval() and Code Injection

Never use `eval()`, `new Function()`, or `setTimeout`/`setInterval` with string arguments on untrusted data. These execute arbitrary code.

**Dangerous patterns:**

```javascript
// NEVER DO THIS
const apiResponse = await fetch(url).then(r => r.text());
eval(apiResponse); // Executes arbitrary code!

const userInput = document.querySelector('#user-field').value;
new Function(userInput)(); // Code injection vulnerability

setTimeout('apiData.' + userProperty, 1000); // Don't pass strings to setTimeout
```

**Alternatives:**
- `JSON.parse()` for JSON data (safe — does not execute code)
- DOM manipulation methods for creating elements
- `textContent` instead of `innerHTML` for inserting text
- Function references for setTimeout/setInterval

```javascript
// SAFE: Parse JSON
const apiData = JSON.parse(apiResponse);

// SAFE: Pass function reference
setTimeout(() => apiData[userProperty](), 1000);

// SAFE: Use proper DOM methods
element.textContent = userInput;
```

## innerHTML and XSS

Using `innerHTML` with any data from external sources (API responses, page content, URL parameters) creates XSS vulnerabilities.

**Vulnerable code:**

```javascript
// UNSAFE: External data in innerHTML
const params = new URLSearchParams(location.search);
document.body.innerHTML += `<div>Hello ${params.get('name')}</div>`;
// URL: ?name=<img src=x onerror=alert(1)>

// UNSAFE: API response in innerHTML
const response = await fetch('/api/data').then(r => r.json());
container.innerHTML = response.htmlContent; // XSS if response is malicious
```

**Safe alternatives:**
- `element.textContent = data` — never parses HTML
- `element.setAttribute('href', url)` — set attributes directly
- Build elements with `document.createElement()` and set properties individually
- Use a sanitization library if HTML rendering is genuinely required

```javascript
// SAFE: Use textContent
const params = new URLSearchParams(location.search);
const div = document.createElement('div');
div.textContent = `Hello ${params.get('name')}`;
document.body.appendChild(div);

// SAFE: Build DOM programmatically
const link = document.createElement('a');
link.textContent = response.linkText;
link.href = response.url; // Attribute assignment is safe
container.appendChild(link);
```

### When innerHTML is Safe

When `innerHTML` is used with hardcoded strings known at write time, it is safe. The danger is dynamic content.

```javascript
// SAFE: Hardcoded string
panel.innerHTML = '<h3>Settings</h3><button>Save</button>';

// UNSAFE: Any dynamic content
panel.innerHTML = `<h3>${title}</h3>`; // title could contain <script>
```

### HTML Sanitization

If HTML rendering is absolutely required, use a sanitization library:

```javascript
// @require https://cdn.jsdelivr.net/npm/dompurify@3.0.6/dist/purify.min.js

const dirty = apiResponse.htmlContent;
const clean = DOMPurify.sanitize(dirty, {
  ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p'],
  ALLOWED_ATTR: ['href']
});
element.innerHTML = clean;
```

## @grant none Implications

With `@grant none`:
- Script runs in the page's JavaScript context directly (no sandbox)
- No GM_* APIs available (except GM_info)
- Script code is visible and modifiable by page scripts
- Simpler but less secure than sandboxed execution

Use `@grant none` only for simple scripts that don't need GM APIs and don't handle sensitive operations. For anything involving network requests, storage, or cross-site communication, use specific grants.

### @grant none Risks

```javascript
// With @grant none, page scripts can modify your code
window.myUserscript = {
  enabled: true,
  doSomething: function() {
    // Page can override this function
  }
};

// Page script could do:
window.myUserscript.doSomething = function() {
  // Malicious replacement
};
```

### When @grant none is Acceptable

```javascript
// Simple DOM manipulation, no privileged operations
// @grant none

document.querySelectorAll('.ad').forEach(ad => ad.remove());
```

## Dependency Integrity (SRI)

Always add Subresource Integrity hashes to @require and @resource:

```
// @require https://cdn.jsdelivr.net/npm/lib@1.2.3/dist/lib.min.js#sha256-base64hash
// @resource data https://example.com/data.json#md5=hexhash
```

This ensures the resource hasn't been tampered with since installation. Without SRI, a compromised CDN could serve malicious code that runs with the userscript's elevated privileges.

Generate hashes:

```bash
# SHA-256 (recommended)
curl -s URL | openssl dgst -sha256 -binary | openssl base64

# SHA-384
curl -s URL | openssl dgst -sha384 -binary | openssl base64

# MD5 (less secure, but supported)
curl -s URL | openssl dgst -md5 -binary | openssl base64
```

### Full @require with SRI

```
// @require https://cdn.jsdelivr.net/npm/jquery@3.6.0/dist/jquery.min.js#sha256-/xUj+3OJU5yExlq6GSYGSHk7tPXikynS7ogEvDej/m4=
```

### SRI Mismatch Handling

If the hash doesn't match, the userscript manager will refuse to load the resource. Update the hash when updating the library version.

## @connect and Least Privilege

Declare only the specific domains needed:

```
// @connect api.example.com
// @connect cdn.example.com
```

Never use `// @connect *` — this allows the script to make requests to any domain, which is a significant security surface.

### Subdomain Wildcards

```
// Allow all subdomains
// @connect *.example.com

// This permits: api.example.com, cdn.example.com, etc.
```

### Security Impact of @connect *

```
// @connect *

// This permits:
// - Requests to any website (credential theft via malicious APIs)
// - Exfiltration of data to attacker-controlled domains
// - Abuse of the user's network for DDoS or scanning
```

Only use `@connect *` for development, never in production scripts.

## Handling External Data

Treat all data from GM_xmlhttpRequest responses as untrusted:

- Validate structure before accessing nested properties
- Use `textContent` when inserting into DOM
- Parse JSON with `JSON.parse()`, never `eval()`
- Check response.status before processing
- Handle malformed responses gracefully

### Safe Data Handling Pattern

```javascript
GM_xmlhttpRequest({
  method: 'GET',
  url: 'https://api.example.com/data',
  responseType: 'json',
  onload: function(response) {
    if (response.status !== 200) {
      console.error('API error:', response.status);
      return;
    }

    try {
      const data = response.response;

      // Validate structure
      if (!data || typeof data.items !== 'object') {
        throw new Error('Invalid response structure');
      }

      // Safe insertion
      data.items.forEach(item => {
        if (typeof item.name === 'string') {
          const div = document.createElement('div');
          div.textContent = item.name; // Safe
          container.appendChild(div);
        }
      });
    } catch (e) {
      console.error('Data processing error:', e);
    }
  }
});
```

## Third-Party @require Scripts

Audit any external scripts loaded via @require:

- Read the source before including
- Pin to a specific version — never use `@latest` or unversioned URLs
- Add SRI hash to prevent tampering
- Prefer well-known CDNs (jsdelivr, cdnjs, unpkg)
- Minimize dependencies — native browser APIs and GM_* functions often suffice

### Risky @require Patterns

```
// RISKY: No version pinning
// @require https://cdn.example.com/library.js

// RISKY: Unpinned CDN URL
// @require https://cdn.example.com/library@latest/dist/lib.js

// RISKY: No SRI hash
// @require https://cdn.example.com/library@1.0.0/dist/lib.js
```

### Safer @require Pattern

```
// SAFER: Pinned version + SRI
// @require https://cdn.jsdelivr.net/npm/library@1.2.3/dist/lib.min.js#sha256-abc123...
```

### Auditing Dependencies

Before adding a @require:

1. Read the library source code
2. Check for known vulnerabilities (npm audit, Snyk)
3. Verify the library is actively maintained
4. Consider the library's permission requirements
5. Evaluate if the functionality can be implemented without the dependency

## Script Distribution Security

When publishing scripts to GreasyFork or OpenUserJS:

- Do not hardcode API keys, tokens, or credentials
- Use GM_getValue for user-specific configuration
- Document what permissions the script requires and why
- Disclose any @antifeature (ads, tracking)

### Safe Configuration Pattern

```javascript
// WRONG: Hardcoded API key
const API_KEY = 'sk_live_abc123...';

// RIGHT: User-provided key
let apiKey = GM_getValue('apiKey');
if (!apiKey) {
  apiKey = prompt('Enter your API key:');
  if (apiKey) {
    GM_setValue('apiKey', apiKey);
  }
}
```

### Required Metadata for Public Scripts

```
// ==UserScript==
// @name         My Script
// @description  What it does
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @connect      api.example.com
// @antifeature  tracking Anonymized usage analytics for development
// ==/UserScript==
```

## Content Security Policy (CSP) Bypass Risks

GM_addElement and similar APIs bypass CSP. This is useful but creates responsibility:

- Only inject trusted code
- Never concatenate user input into injected scripts
- Validate all external resources before injection
- Use SRI for @resource and @require

### CSP Bypass Misuse

```javascript
// DANGEROUS: User input in injected script
const userCode = prompt('Enter custom code:');
GM_addElement('script', {
  textContent: userCode // Arbitrary code execution!
});

// SAFER: Controlled injection
const allowedActions = {
  'hide-ads': '...',
  'dark-mode': '...'
};
const action = allowedActions[userInput];
if (action) {
  GM_addElement('script', { textContent: action });
}
```

## Secure Storage

GM_setValue stores data locally but without encryption:

- Don't store plaintext passwords or tokens
- Use secure session tokens instead of long-lived credentials
- Clear sensitive data when no longer needed

```javascript
// Avoid storing sensitive data
GM_setValue('password', userPassword); // NO

// Store tokens with expiration
const token = { value: apiToken, expires: Date.now() + 3600000 };
GM_setValue('token', JSON.stringify(token));

// Clear on logout
GM_deleteValue('token');
```
