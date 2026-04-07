---
name: userscripting
description: PLACEHOLDER — user will write trigger description
---

# UserScript Development

## Overview

UserScripts are JavaScript programs that run in the browser via a userscript manager (Tampermonkey, Violentmonkey, or Greasemonkey). They modify web page behavior and appearance by injecting code into matched URLs. This skill provides the procedural knowledge, API reference, and patterns needed to write correct, secure, cross-manager-compatible userscripts.

## Development Approach

Internalize these principles before writing any code. They shape every decision downstream.

### The Development Loop (Agentic Reality)

There is no autonomous access to installing or running a userscript in-manager. The development loop is:

1. **Write code** — draft the script with the full `==UserScript==` metadata block, but understand the GM_* APIs won't be available during console testing
2. **Test via browser console injection** — paste the script body (without the metadata block) into the browser's DevTools console on the target page. Stub out any GM_* calls as needed (e.g., `const GM_getValue = (k, d) => d;`)
3. **Iterate** — fix issues found during console testing. Do not defer problems to "later when it's in the manager"
4. **User assists with in-manager testing** — once core functionality works in-console, the user installs the full script in Tampermonkey/Violentmonkey and reports back

This means: write the script to be testable. Keep the GM_* API surface small so stubbing is easy. Fix everything fixable before handing off to the user for in-manager testing.

### Assume SPA Until Proven Otherwise

No page can be trusted to be fully server-rendered anymore. SPA/CSR, `fetch()` content loading, lazy loading, and infinite scroll are everywhere. Unless there is strong evidence the target site uses traditional server-side rendering on all relevant pages, default to using MutationObserver from the start. Do not deregister the main MutationObserver — pushState and hash-based navigation do not reload the userscript.

### Error Handling Philosophy

Define a debug logging function and use it liberally:
```javascript
const DEBUG = true;
function logdebug(...args) { if (DEBUG) console.log('[MyScript]', ...args); }
```

Do not silently swallow exceptions except genuinely expected ones in tight loops or fast timers (and even then, consider `logdebug`). For all other cases, use `console.warn` or `console.error`. But never re-throw or leave uncaught exceptions in code paths that would break the page's own functionality.

### Selector Resilience

Think like a QA engineer writing stable browser tests. Prefer selectors that will survive site updates:
- **Best:** Structural/semantic selectors — `article`, `header > nav[aria-label="main"]`, `[role="dialog"]`, `[data-testid="specific-name"]` (when the testid looks intentional and stable)
- **Acceptable:** Human-written, descriptive class names that look stable — `.user-profile-card`, `.comment-body`
- **Last resort:** Framework-generated class names — `.css-1a2b3c`, `._3xKp2` — only when used in unique "signature" combinations
- **Avoid:** Randomized IDs, deeply nested positional selectors (`div > div > div:nth-child(3)`), anything that looks auto-generated

A complex matching strategy targeting stable page landmarks is far better than a simple one targeting fragile selectors.

### Namespace Everything

Use `x-userjs-` prefixes on injected element IDs, class names, and data attributes to avoid collisions with the page. Use an IIFE or block scope to keep variables and functions out of the global/window namespace. Placing anything on `window` should be intentional and purposeful.

### Priority Order

When making trade-offs during development:
1. **Do not break site functionality** in ways that matter (free to break things during development iterations)
2. **Do not break site layout** in ways that matter (free to break things during development iterations)
3. **Implement the userscript's functional requirements** to the best of available abilities — consult with the user if a feature is proving too complex, to explore functional compromises or alternative approaches
4. **Match the page's visual style** — the result should look like it belongs

### When Stuck

If a particularly tricky aspect of implementation is consuming excessive effort, consult with the user. Often the functional requirement can be relaxed, an alternative approach exists that wasn't obvious, or the user has domain knowledge about the target site that changes the picture. Do not grind silently on a hard problem when a conversation might dissolve it.

For deeper development guidance including testing workflow, optimization philosophy, and working with page primitives, read `references/practical-guidance.md`.

### Starter Template

This template embodies the principles above — scoped closure, debug logging, DOM query helpers, XPath support, and a persistent MutationObserver. Start every userscript from this skeleton:

```javascript
// ==UserScript==
// @name        Script Name
// @namespace   https://example.com/
// @version     0.1.0
// @description Brief description
// @author      Author
// @match       *://www.example.com/*
// @grant       none
// @run-at      document-idle
// @noframes
// ==/UserScript==

(() => {
    const GM_info_safe = (typeof GM_info !== 'undefined') ? GM_info : {script: {name: 'UserScript'}};
    const logdebug = 1 ? console.log.bind(console, `ujs:${GM_info_safe.script.name}:`) : () => {};
    const $ = (selector, ctx = document) => ctx.querySelector(selector);
    const $$ = (selector, ctx = document) => [...ctx.querySelectorAll(selector)];
    const $x = (xp, ctx = document) => {
        const qr = document.evaluate(xp, ctx, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null), r = [];
        for (let i = 0; i < qr.snapshotLength; i++) r.push(qr.snapshotItem(i));
        return r;
    };

    const obsConfig = { childList: true, subtree: true };
    const obs = new MutationObserver(onPageChanged);
    obs.observe(document, obsConfig);

    function onPageChanged(mutationList, obs) {
    }

    onPageChanged([]);
})();
```

Adapt this template for each new script. Add `@grant` declarations and GM_* calls as needed.

## Workflow: Writing a UserScript

### 1. Define the Metadata Block

Every userscript begins with a `==UserScript==` metadata block in line comments. Start from this template and adjust:

```javascript
// ==UserScript==
// @name        Script Name
// @namespace   https://example.com/
// @version     1.0.0
// @description Brief description of what the script does
// @author      Author Name
// @match       *://www.example.com/*
// @grant       none
// @run-at      document-idle
// ==/UserScript==
```

**Essential tags for every script:**

| Tag | Purpose | Notes |
|-----|---------|-------|
| `@name` | Script identifier | Unique within namespace |
| `@match` | URL pattern to run on | Always prefer `@match` over `@include` |
| `@grant` | API permissions | `none` for minimal sandbox; add specific GM_* as needed |
| `@version` | Semantic version | Required for auto-updates |
| `@run-at` | Injection timing | `document-idle` (default safe choice), `document-end`, `document-start` |

**@match pattern quick reference:**
- `*://www.example.com/*` — http and https, specific domain
- `*://*.example.com/*` — all subdomains
- `*://www.example.tld/*` — all TLDs (.com, .co.uk, etc.)
- Ignores query strings and hash fragments

For the complete tag reference with all options, cross-manager notes, and pattern syntax details, read `references/metadata-block.md`.

### 2. Determine Required Permissions

Start with `@grant none` and add permissions only as needed. Each `@grant` declaration enables a specific GM_* function.

**Common grant combinations by task:**

| Task | Required Grants |
|------|----------------|
| Modify page CSS | `@grant GM_addStyle` |
| Store persistent data | `@grant GM_setValue` + `@grant GM_getValue` |
| Cross-origin API calls | `@grant GM_xmlhttpRequest` + `@connect targetdomain.com` |
| Add menu commands | `@grant GM_registerMenuCommand` |
| Access page JS objects | `@grant unsafeWindow` |
| Detect SPA navigation | `@grant window.onurlchange` (Tampermonkey) |

When `@grant` specifies any value other than `none`, the script runs in a sandbox with access only to granted APIs. With `@grant none`, the script shares the page's JavaScript context directly — simpler but with no GM_* API access (except `GM_info`).

For the full API reference with function signatures, parameters, and usage notes, read `references/gm-api.md`.

### 3. Write the Script Body

Select the appropriate pattern for the task:

**DOM modification and CSS injection** — Hide elements, restyle pages, add UI components. Use `GM_addStyle` for CSS and standard DOM APIs for element manipulation.
→ For patterns and CSP bypass techniques, read `references/css-and-dom-injection.md`

**SPA and dynamic content handling** — For sites like YouTube, GitHub, or Twitter where content loads dynamically without full page reloads. Use MutationObserver to detect changes and manage observer lifecycle.
→ For MutationObserver patterns and SPA strategies, read `references/spa-and-dynamic-dom.md`

**Cross-origin API requests** — Fetch data from external APIs that would normally be blocked by CORS. Use `GM_xmlhttpRequest` with `@connect` declarations.
→ For request patterns and MV3 considerations, read `references/cross-origin-and-network.md`

**Persistent storage and state** — Save user preferences, track state across sessions. Use `GM_setValue`/`GM_getValue` for key-value storage.
→ Covered in the Storage section of `references/gm-api.md`

**@require for external libraries** — Prefer native browser APIs and GM_* functions where practical. Only `@require` external libraries when they provide high impact for the specific task (e.g., a complex date manipulation library). Always pin versions and use SRI hashes.

### 4. Handle Edge Cases

Review this checklist before finalizing:

- [ ] **Iframes**: Add `@noframes` unless the script must run inside iframes
- [ ] **Timing**: Verify `@run-at` matches the use case — `document-start` has no DOM; `document-idle` waits for full load
- [ ] **External domains**: Add `@connect` for every domain accessed via `GM_xmlhttpRequest`
- [ ] **Dependency integrity**: Add SRI hashes to `@require` and `@resource` URLs
- [ ] **SPA sites**: If the target is an SPA, match the entire domain and handle route changes in code
- [ ] **CSP**: If the target site has a strict Content Security Policy, use `GM_addStyle`/`GM_addElement` instead of inline injection

### 5. Review and Validate

Run `scripts/validate-metadata.sh` against the script to catch common metadata errors.

For a security review of the script, consult `references/security.md`. Key items:
- No `eval()` or `innerHTML` with untrusted data
- `unsafeWindow` access is justified and safe
- External data is treated as untrusted
- `@grant none` is intentional, not accidental

For cross-manager compatibility concerns, consult `references/manager-compatibility.md`.

## Common Mistakes

1. **Using `@include` instead of `@match`** — `@match` is stricter and safer. Use it exclusively unless regex matching is genuinely required.
2. **Forgetting `@connect`** — `GM_xmlhttpRequest` silently fails without a matching `@connect` declaration for the target domain.
3. **Using `@grant none` then calling GM_* functions** — With `@grant none`, no GM_* APIs are available (except `GM_info`). Add specific grants.
4. **Not handling SPA navigation** — Scripts only execute on "hard" navigations. SPA route changes require MutationObserver or URL change listeners.
5. **`@run-at document-start` with DOM operations** — The DOM does not exist yet at `document-start`. Use `document-end` or `document-idle` for DOM manipulation, or wait for elements explicitly.
6. **Missing `@noframes`** — Without it, the script runs in every iframe on the page, potentially causing duplicated effects or errors.
7. **`@require` without version pinning** — Unpinned CDN URLs can serve breaking changes. Always pin to a specific version and add SRI hash.

## Reference Map

| Scenario | Reference File |
|----------|---------------|
| Metadata tag syntax and options | `references/metadata-block.md` |
| GM_* function signatures and usage | `references/gm-api.md` |
| SPA sites, dynamic DOM, MutationObserver | `references/spa-and-dynamic-dom.md` |
| Cross-origin requests, CORS bypass | `references/cross-origin-and-network.md` |
| CSS injection, element creation, CSP | `references/css-and-dom-injection.md` |
| Security review, unsafeWindow, SRI | `references/security.md` |
| Manager differences, MV3, compatibility | `references/manager-compatibility.md` |
| Development workflow, testing, optimization | `references/practical-guidance.md` |

## Examples

Working example scripts in `examples/`:

- **`examples/basic-dom-modifier.js`** — Hide elements and inject custom CSS on a target site
- **`examples/spa-observer.js`** — SPA-aware script with MutationObserver lifecycle management
- **`examples/api-fetcher.js`** — Cross-origin API call with GM_xmlhttpRequest and floating result panel
- **`examples/full-featured.js`** — Menu commands, persistent storage, CSS injection, and notifications
