# Metadata Block Reference

## Block Format

Use line comments exclusively for the metadata block. Block comments (`/* */`) are not valid.

Begin the metadata block with exactly:
```
// ==UserScript==
```

End the metadata block with exactly:
```
// ==/UserScript==
```

Both delimiters must start at the beginning of the line with no leading whitespace.

Format each metadata key as:
```
// @key value
```

Use exactly one space after `//` and one space after the `@key`. Place the metadata block at the very top of the script file before any other code.

## Core Identity Tags

### @name
Declares the script's display name shown in the userscript manager UI.

Supports internationalization using locale suffixes:
```
// @name My Script
// @name:zh-CN 我的脚本
// @name:ja マイスクリプト
```

The base `@name` without a locale suffix serves as the fallback. Use standard language codes (ISO 639-1) and optional region codes (ISO 3166-1).

### @namespace
Provides a unique identifier to distinguish scripts with the same name by different authors. Use a URL you control or a reversed domain name:
```
// @namespace https://github.com/username
// @namespace com.example.username
```

Userscript managers use the combination of `@namespace` and `@name` to uniquely identify scripts.

### @description
Explains what the script does. Shown in the manager UI and on script sharing sites.

Supports internationalization like `@name`:
```
// @description Enhances the example site with extra features
// @description:es Mejora el sitio de ejemplo con funciones adicionales
```

### @version
Specifies the current version using dot-separated numbers (semantic versioning recommended):
```
// @version 1.0.0
// @version 2.3.1
```

Required for automatic updates. Userscript managers compare version numbers to determine if an update is available. Without `@version`, auto-update functionality does not work.

### @author
Credits the script creator:
```
// @author Jane Developer
// @author username <email@example.com>
```

### @icon and @icon64
Display icons in the manager UI. Use `@icon` for standard resolution and `@icon64` for 64x64 pixel icons:
```
// @icon https://example.com/icon.png
// @icon64 https://example.com/icon-64.png
```

Support common image formats (PNG, JPEG, SVG). Can also use data URIs for embedded icons.

## URL Matching

### @match (Recommended)

Defines which URLs the script runs on using a strict pattern format:
```
scheme://host/path
```

**Scheme component:**
- `*` — matches both `http` and `https`
- `http` — matches only HTTP
- `https` — matches only HTTPS
- `http*` — matches both HTTP and HTTPS (Violentmonkey extension)

**Host component:**
- `*` — matches any host
- `example.com` — matches exactly `example.com`
- `*.example.com` — matches `example.com` and all subdomains (`sub.example.com`, `deep.sub.example.com`)
- `example.*` — matches `example` with any TLD (`example.com`, `example.org`, etc.)

**Path component:**
- `*` — matches any path including empty path
- `/` — matches root path only
- `/specific/path` — matches exactly this path
- `/path/*` — matches `/path/` and anything under it

The `@match` pattern ignores query strings and URL fragments. These patterns do not support regex.

#### Common @match Patterns

| Pattern | Matches | Notes |
|---------|---------|-------|
| `*://*/*` | All HTTP and HTTPS sites | Broadest possible match |
| `*://example.com/*` | All pages on example.com | Exact domain only |
| `*://*.example.com/*` | All pages on example.com and subdomains | Includes domain itself |
| `*://example.*/*` | example.com, example.org, etc. | Any top-level domain |
| `https://example.com/` | Root page of example.com via HTTPS | Exact match, no subpages |
| `*://example.com/section/*` | All pages under /section/ | Specific path prefix |
| `http://example.com/*` | HTTP only, not HTTPS | Protocol-specific |

Use multiple `@match` lines to run on multiple distinct patterns:
```
// @match *://example.com/*
// @match *://another-site.org/*
```

### @match vs @include

Prefer `@match` over `@include` for better security and predictability.

`@include` supports broader wildcards and regular expressions:
```
// @include https://example.com/*
// @include /^https://example\.(com|org)/.*$/
```

Regular expressions must be wrapped in forward slashes. While more flexible, `@include` patterns can be less secure because wildcards match more liberally than `@match` patterns.

### @exclude and @exclude-match

Override `@match` or `@include` to prevent execution on specific URLs:
```
// @match *://example.com/*
// @exclude *://example.com/admin/*
```

`@exclude-match` uses the same strict pattern format as `@match`. `@exclude` uses the same liberal pattern format as `@include` (including regex support).

Both exclusions take precedence over inclusions.

### Default Behavior

If a script specifies neither `@match` nor `@include`, behavior varies by manager:
- Most managers: Script runs nowhere by default
- Some managers: May treat as `*://*/*` (all sites)

Always explicitly declare URL patterns. Never rely on default behavior.

## Execution Control

### @run-at

Controls when the script executes relative to page load. Choose based on what the script needs to access.

| Value | Timing | Use Cases | Limitations |
|-------|--------|-----------|-------------|
| `document-start` | Before DOM construction begins | Intercept early network requests, block inline scripts, set up request listeners, modify headers | No DOM APIs available, cannot query elements |
| `document-body` | As soon as `<body>` tag exists | Very early DOM manipulation | Rarely needed, most content still loading |
| `document-end` | DOM fully constructed, external resources may still load | Standard DOM manipulation, event listeners | Images, stylesheets, iframes may not be loaded |
| `document-idle` | After full page load including external resources | Safest for most scripts, everything available | Runs later, may miss early events |
| `context-menu` | When user triggers from context menu (Tampermonkey only) | On-demand actions | Requires user interaction |

Default value: `document-idle` in most managers.

For most DOM manipulation scripts, use `document-end` for faster execution or `document-idle` for maximum safety.

Examples:
```
// @run-at document-end
```

```
// @run-at document-start
```

### @noframes

Restricts script execution to the top-level document, preventing execution in iframes:
```
// @noframes
```

Add this tag unless the script intentionally needs to run in iframe contexts. Prevents duplicate execution and reduces resource usage.

### @inject-into (Violentmonkey-specific)

Controls the JavaScript execution context:

**Options:**
- `page` — Inject into the page's global scope. Full access to page variables and functions. Default in Chrome.
- `content` — Inject into an isolated content script context. No access to page JavaScript. Safe from page CSP restrictions.
- `auto` — Try `page` mode first, fall back to `content` if necessary.

Example:
```
// @inject-into content
```

Use `page` when the script needs to interact with page JavaScript (accessing page variables, calling page functions). Use `content` when the script only manipulates the DOM and needs CSP protection.

This tag is Violentmonkey-specific. Tampermonkey uses `@sandbox` instead.

### @sandbox (Tampermonkey-specific)

Controls sandboxing behavior:

**Options:**
- `raw` — No sandbox, direct page access (similar to Violentmonkey's `page` mode)
- `JavaScript` — JavaScript execution sandbox
- `DOM` — DOM sandbox with restricted JavaScript access

Example:
```
// @sandbox raw
```

Use `raw` when needing direct page context access. Leave unspecified for default sandboxed behavior.

## Dependencies and Resources

### @require

Loads external JavaScript libraries before script execution. The userscript manager downloads these files once during installation and stores them locally.

Format:
```
// @require https://cdn.jsdelivr.net/npm/jquery@3.6.0/dist/jquery.min.js
```

**Version pinning:**
Always pin to specific versions to prevent breaking changes:
```
// @require https://cdn.jsdelivr.net/npm/lodash@4.17.21/lodash.min.js
```

**Subresource integrity (SRI):**
Add hash verification for security:
```
// @require https://example.com/lib.js#sha256-base64hash
// @require https://example.com/lib.js#md5=hexhash
```

Generate SRI hashes using online tools or command-line utilities.

**Important limitations:**
- ES modules (import/export) do not work in required libraries
- All code executes as a single concatenated script
- Required libraries must be plain JavaScript files

**Best practices:**
- Prefer native browser APIs (`fetch`, `querySelector`, etc.) over libraries
- Prefer GM_* functions over library equivalents
- Only require libraries that provide significant value
- Use CDNs that support version pinning (jsDelivr, unpkg, cdnjs)

Multiple `@require` lines load in order:
```
// @require https://cdn.jsdelivr.net/npm/jquery@3.6.0/dist/jquery.min.js
// @require https://cdn.jsdelivr.net/npm/moment@2.29.4/moment.min.js
```

### @resource

Declares named remote resources downloaded at installation. Access these resources at runtime using `GM_getResourceText` and `GM_getResourceURL`.

Format:
```
// @resource resourceName https://example.com/resource.css
```

The first argument is a custom name used to reference the resource. The second argument is the URL.

**SRI hashes supported:**
```
// @resource myStyle https://example.com/style.css#sha256-base64hash
```

**Accessing resources:**
```javascript
// Get resource as text
const cssText = GM_getResourceText('resourceName');

// Get resource as blob URL
const imageURL = GM_getResourceURL('resourceName');
```

**Common use cases:**
- CSS files: Load via `GM_addStyle(GM_getResourceText('myCSS'))`
- JSON data: Parse with `JSON.parse(GM_getResourceText('myData'))`
- Images: Use as src with `GM_getResourceURL('myImage')`
- Text templates: Retrieve with `GM_getResourceText('myTemplate')`

Resources must be declared with `@grant GM_getResourceText` and/or `@grant GM_getResourceURL`.

## Permissions

### @grant

Declares which GM_* API functions the script requires. This tag controls sandboxing behavior and API availability.

**Special value:**
```
// @grant none
```

With `@grant none`, the script runs directly in the page context with no sandbox. No GM_* APIs are available. Use this for scripts that only need standard DOM APIs and want page JavaScript access.

**When any @grant other than none is specified**, the script runs in an isolated sandbox. This provides security but prevents direct access to page variables and functions.

**Common GM_* APIs:**

Storage:
```
// @grant GM_getValue
// @grant GM_setValue
// @grant GM_deleteValue
// @grant GM_listValues
```

Network requests:
```
// @grant GM_xmlhttpRequest
```

UI modifications:
```
// @grant GM_addStyle
// @grant GM_addElement
```

User interaction:
```
// @grant GM_registerMenuCommand
// @grant GM_unregisterMenuCommand
// @grant GM_notification
```

Tabs and windows:
```
// @grant GM_openInTab
// @grant window.close
// @grant window.focus
```

Clipboard:
```
// @grant GM_setClipboard
```

Resources:
```
// @grant GM_getResourceText
// @grant GM_getResourceURL
```

Downloads:
```
// @grant GM_download
```

**Special grants:**

`unsafeWindow` — Access the page's global window object from a sandboxed script:
```
// @grant unsafeWindow
```

Use this when needing both sandboxed GM_* APIs and page JavaScript access.

`window.onurlchange` — Detect URL changes in single-page applications (Tampermonkey only):
```
// @grant window.onurlchange
```

**Multiple grants:**
Declare each needed API on a separate line:
```
// @grant GM_getValue
// @grant GM_setValue
// @grant GM_xmlhttpRequest
// @grant GM_addStyle
```

### @connect

Whitelists domains for cross-origin requests via `GM_xmlhttpRequest`. Required for each external domain the script connects to.

Format:
```
// @connect example.com
```

**Supported values:**
- Exact domain names: `example.com`
- IP addresses: `192.168.1.1`
- Subdomain wildcards: `*.example.com`
- `self` — The site the script runs on
- `localhost` — Local connections
- `*` — All domains (avoid this; reduces security)

**Multiple connections:**
```
// @connect api.example.com
// @connect cdn.example.org
// @connect self
```

**Requirements:**
- Must also have `@grant GM_xmlhttpRequest`
- Omitting required `@connect` entries causes requests to fail silently or prompt the user

**Manager differences:**
- Tampermonkey and Violentmonkey: Strictly enforce `@connect`
- Greasemonkey: Different cross-origin handling

Always declare all remote domains the script contacts.

## Distribution and Updates

### @updateURL and @downloadURL

Enable automatic updates by specifying where to check for new versions and where to download updated scripts.

`@updateURL` — Where to check for updates (can serve just metadata or the full script):
```
// @updateURL https://example.com/my-script.meta.js
// @updateURL https://example.com/my-script.user.js
```

`@downloadURL` — Where to download the updated script:
```
// @downloadURL https://example.com/my-script.user.js
```

**Requirements for auto-update:**
- `@version` tag must be present
- The update check URL must return a script with a higher version number

If `@downloadURL` is omitted, the manager uses `@updateURL` for both checking and downloading.

**Common hosting:**
- GitHub Gist: Use raw URLs
- GitHub repository: Use raw.githubusercontent.com URLs
- Greasy Fork: Auto-provides update URLs
- Personal server: Host .user.js or .meta.js files

Update checks typically occur daily or on manager startup.

### @supportURL

Link for users to get help, report bugs, or ask questions:
```
// @supportURL https://github.com/username/repo/issues
// @supportURL https://greasyfork.org/scripts/12345/feedback
```

Shown in userscript manager UI.

### @homepageURL

Link to the script's homepage or main documentation:
```
// @homepageURL https://github.com/username/my-script
// @homepageURL https://example.com/my-script
```

Provides users with more information about the script.

### @antifeature (Tampermonkey-specific)

Discloses potentially undesirable features to users. Required for transparency on some script-sharing platforms.

**Values:**
- `ads` — Script displays advertisements
- `tracking` — Script tracks user behavior
- `miner` — Script mines cryptocurrency

Format:
```
// @antifeature ads Revenue from non-intrusive ads
// @antifeature tracking Anonymous usage statistics
```

The text after the feature type explains the purpose.

## Cross-Manager Compatibility

Different userscript managers support different metadata tags and interpret some tags differently.

| Tag | Tampermonkey | Violentmonkey | Greasemonkey |
|-----|--------------|---------------|--------------|
| `@match` | Full support | Full support | Full support |
| `@run-at` | All values including `context-menu` | All values except `context-menu` | `document-start`, `document-end`, `document-idle` only |
| `@inject-into` | Not supported (use `@sandbox`) | Full support (`page`, `content`, `auto`) | Not supported |
| `@sandbox` | Full support (`raw`, `JavaScript`, `DOM`) | Not supported (use `@inject-into`) | Not supported |
| `@connect` | Full support | Full support | Different implementation |
| `@grant window.onurlchange` | Supported | Not supported | Not supported |
| `@antifeature` | Supported | Supported on Greasy Fork | Supported on Greasy Fork |
| `@webRequest` | Supported (Manifest V2 only) | Not supported | Not supported |
| `@resource` | Full support | Full support | Full support |

**Key compatibility notes:**

**Context injection:**
- Violentmonkey: Use `@inject-into page` for page context access
- Tampermonkey: Use `@sandbox raw` for page context access
- When writing cross-manager scripts, test both approaches or target one manager

**@run-at timing:**
- `document-body` works in Tampermonkey and Violentmonkey only
- Greasemonkey supports only `document-start`, `document-end`, `document-idle`
- For maximum compatibility, use `document-start`, `document-end`, or `document-idle`

**@connect behavior:**
- Tampermonkey and Violentmonkey require explicit `@connect` declarations
- Greasemonkey handles cross-origin differently
- Always declare `@connect` for external API calls

**window.onurlchange:**
- Tampermonkey exclusive feature for SPA URL change detection
- In other managers, use MutationObserver or polling for URL changes

**@webRequest:**
- Tampermonkey only, and only in Manifest V2 browsers
- Allows intercepting and modifying network requests
- Not available in Manifest V3

## Common Metadata Mistakes

### 1. Missing @version
**Problem:** Auto-update functionality does not work without version numbers.

**Solution:** Always include a version:
```
// @version 1.0.0
```

### 2. Invalid @match pattern (missing scheme)
**Problem:** Patterns like `example.com/*` are invalid.

**Solution:** Always include a scheme:
```
// @match *://example.com/*
```

### 3. Using GM_* functions with @grant none
**Problem:** `@grant none` disables all GM_* APIs, causing undefined function errors.

**Solution:** Declare each needed API:
```
// @grant GM_getValue
// @grant GM_setValue
```

Or remove `@grant none` if using GM_* functions.

### 4. Using @include when @match suffices
**Problem:** `@include` is less safe and less predictable than `@match`.

**Solution:** Use `@match` unless regex matching is truly required:
```
// @match *://example.com/*
```

### 5. Unpinned @require URLs
**Problem:** CDNs can serve breaking changes when using floating versions like `@latest`.

**Solution:** Pin to specific versions:
```
// @require https://cdn.jsdelivr.net/npm/jquery@3.6.0/dist/jquery.min.js
```

### 6. Missing @connect declarations
**Problem:** `GM_xmlhttpRequest` calls fail silently or trigger permission prompts.

**Solution:** Whitelist all external domains:
```
// @grant GM_xmlhttpRequest
// @connect api.example.com
```

### 7. Using @run-at document-start with DOM code
**Problem:** DOM APIs are unavailable before the DOM exists, causing null reference errors.

**Solution:** Use `document-end` or `document-idle` for DOM manipulation:
```
// @run-at document-end
```

Or add event listeners that wait for DOM ready:
```javascript
// When using document-start
window.addEventListener('DOMContentLoaded', () => {
  // DOM code here
});
```

### 8. Forgetting @noframes
**Problem:** Scripts execute in every iframe, causing duplicate actions and wasted resources.

**Solution:** Add `@noframes` unless iframe execution is intentional:
```
// @noframes
```

### 9. Using relative URLs in @require or @resource
**Problem:** Relative URLs do not resolve correctly in userscript context.

**Solution:** Always use absolute URLs with scheme:
```
// @require https://cdn.example.com/library.js
```

### 10. Mixing @grant values incorrectly
**Problem:** Using `@grant none` alongside other `@grant` declarations creates conflicting contexts.

**Solution:** Either use `@grant none` alone or list all needed APIs without `none`:
```
// Correct - no GM APIs
// @grant none
```

```
// Correct - specific APIs
// @grant GM_getValue
// @grant GM_setValue
```

```
// Incorrect - conflicting
// @grant none
// @grant GM_getValue
```

## Minimal Example

Complete minimal metadata block for a basic script:
```javascript
// ==UserScript==
// @name         Example Script
// @namespace    https://github.com/username
// @version      1.0.0
// @description  Does something useful on example.com
// @author       Your Name
// @match        *://example.com/*
// @grant        none
// ==/UserScript==
```

## Complete Example

Comprehensive metadata block using many features:
```javascript
// ==UserScript==
// @name         Advanced Example Script
// @name:es      Script de Ejemplo Avanzado
// @namespace    https://github.com/username
// @version      2.3.1
// @description  Comprehensive example showing metadata features
// @description:es Ejemplo completo mostrando características de metadatos
// @author       Your Name
// @icon         https://example.com/icon.png
// @match        *://example.com/*
// @match        *://api.example.com/*
// @exclude      *://example.com/admin/*
// @require      https://cdn.jsdelivr.net/npm/jquery@3.6.0/dist/jquery.min.js
// @resource     customCSS https://example.com/styles.css
// @resource     userData https://example.com/data.json
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_xmlhttpRequest
// @grant        GM_addStyle
// @grant        GM_getResourceText
// @grant        GM_registerMenuCommand
// @connect      api.example.com
// @connect      cdn.example.com
// @connect      self
// @run-at       document-end
// @noframes
// @updateURL    https://example.com/advanced-script.meta.js
// @downloadURL  https://example.com/advanced-script.user.js
// @supportURL   https://github.com/username/repo/issues
// @homepageURL  https://github.com/username/repo
// ==/UserScript==
```

This reference covers the essential metadata tags needed for robust userscript development across different userscript managers.