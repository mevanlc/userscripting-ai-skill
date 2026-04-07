---
name: userscripting
description: PLACEHOLDER — user will write trigger description
---

# UserScript Development

## Overview

UserScripts are JavaScript programs that run in the browser via a userscript manager (Tampermonkey, Violentmonkey, or Greasemonkey). They modify web page behavior and appearance by injecting code into matched URLs. This skill covers both the knowledge and the agentic development workflow needed to build userscripts iteratively using browser automation tools.

## Development Principles

Internalize these before writing any code.

### Assume SPA Until Proven Otherwise

Unless there is strong evidence the target site uses traditional server-side rendering, default to using MutationObserver from the start. SPA/CSR, `fetch()` content loading, lazy loading, and infinite scroll are everywhere. Do not deregister the main MutationObserver — pushState and hash-based navigation do not reload the userscript.

### Selector Resilience

Think like a QA engineer writing stable browser tests:
- **Best:** Structural/semantic — `article`, `header > nav[aria-label="main"]`, `[role="dialog"]`, `[data-testid="specific-name"]`
- **Acceptable:** Human-written descriptive classes — `.user-profile-card`, `.comment-body`
- **Last resort:** Framework-generated classes — `.css-1a2b3c` — only in unique "signature" combinations
- **Avoid:** Randomized IDs, deep positional selectors, auto-generated anything

A complex matching strategy targeting stable landmarks is better than a simple one targeting fragile selectors. For more detail, read `references/practical-guidance.md` (Selector Stability Deep Dive).

### Namespace Everything

Use `x-userjs-` prefixes on injected element IDs, class names, and data attributes. Wrap the script body in an IIFE or block scope. Placing anything on `window` should be intentional.

### Keep GM_* Surface Small

During agentic development, code runs via `javascript_tool` where GM_* APIs are not available. Design the script so that most logic works without GM_* calls. This makes iterative development faster and reduces stubbing. The GM_* integration layer can be thin and added late.

### Error Handling

Define a debug logging function and use it liberally:
```javascript
const DEBUG = true;
const logdebug = DEBUG ? console.log.bind(console, '[MyScript]') : () => {};
```

Do not silently swallow exceptions. Use `console.warn` or `console.error` for real problems. Never re-throw or leave uncaught exceptions that would break the page.

### Priority Order

When making trade-offs:
1. **Do not break site functionality** (free to break things during dev iterations)
2. **Do not break site layout** (free to break things during dev iterations)
3. **Implement the functional requirements** — consult with the user if a feature is proving too complex
4. **Match the page's visual style** — the result should look like it belongs

### When Stuck

If a tricky aspect of implementation is consuming excessive effort, consult with the user. Often the requirement can be relaxed, an alternative approach exists, or the user has domain knowledge that changes the picture. If you've iterated on the same problem ~20 times, describe the challenge and ask for ideas.

## Agentic Development Workflow

This is the primary development strategy when browser automation tools are available. Use `localStorage` as a persistent workspace to store code chunks, enabling rapid iteration without regenerating working code.

### Why localStorage

1. **Persist code across page reloads** — no need to regenerate code that already works
2. **Iterate incrementally** — fix/update individual chunks without rewriting everything (saves tokens and time)
3. **Test quickly** — reload the page and re-execute all chunks from a fresh DOM state with a single command
4. **Easy export** — user retrieves the assembled userscript instantly via a console command

### Setting Up the Workspace

At the start of a session, store a userscript generator function in localStorage. This function concatenates all chunks and assembles them into a complete `.user.js` file:

```javascript
// Store the generator under this key:
// localStorage key: claude_dev_assemble_userscript

(() => {
    let header = `
    // ==UserScript==
    // @name         {{userscriptName}}
    // @namespace    https://greasyfork.org/en/users/1337417-mevanlc
    // @version      0.1
    // @description  {{userscriptDescription}}
    // @author       mevanlc
    // @match        {{urlMatchPattern}}
    // @grant        none
    // @run-at       document-end
    // @license      MIT
    // ==/UserScript==
    `;

    let claudeDevChunkNames = Object.keys(localStorage).filter(k => k.startsWith('claude_dev_chunk:')).sort();
    let body = claudeDevChunkNames.map(k => localStorage.getItem(k)).join('\n\n');
    return header + '\n' + body;
})();
```

Fill in the `{{placeholders}}` with actual values for the userscript being developed. Adjust `@grant`, `@run-at`, and other metadata as needed for the specific script.

### Working with Chunks

Store individual pieces of the userscript under `localStorage` keys prefixed with `claude_dev_chunk:`. Chunks are sorted alphabetically by key, so use `!` and `~` for first/last ordering:

```
claude_dev_chunk:!            - Always injects first (initialization, shared utilities)
claude_dev_chunk:styles       - CSS styles
claude_dev_chunk:hideElements - DOM manipulation
claude_dev_chunk:keyboard     - Keyboard shortcuts
claude_dev_chunk:lightbox     - Modal/dialog functionality
claude_dev_chunk:~            - Always injects last (final setup, observers)
```

Each chunk is a string of JavaScript code that can be passed to `eval()` or used as the body of a `document.createElement('script')`.

**Chunk organization is flexible.** The number and granularity of chunks should match the task. Split sections under heavy development into separate chunks for easier iteration. For some tasks, one chunk per function makes sense. Refactor chunks at any time — copy values between keys, concatenate, rename, split, delete. Make surgical edits to individual chunks using regex search/replace or string manipulation.

### Reading Form Element Values

The `read_page` and `get_page_text` tools often do not show the `.value` of form elements (`TEXTAREA`, `INPUT`, etc.). Use `javascript_tool` to read their contents:

```javascript
document.querySelector('#myTextarea').value
```

This comes up frequently when working on pages with forms — don't assume `read_page` gave you the full picture.

### The Development Loop

1. **Analyze the page** — use `read_page`, `javascript_tool`, and screenshots to understand the DOM structure, find stable selectors, and identify the elements to modify
2. **Create chunks** — build reusable code with observable effects that allow verification (think Unix philosophy: each chunk should do one thing and show that it worked)
3. **Test by executing** — run chunks via `javascript_tool` and verify results with screenshots
4. **Reload and verify** — periodically reload the page (navigate to the original URL, don't call `.reload()` which can trigger SPA URL modifications) to confirm everything works from a fresh DOM state
5. **Iterate** — fix/update individual chunks without touching the ones that already work

**Dogfooding:** When testing the full script during development, run it through the generator to ensure you're testing exactly what the user will get:
```javascript
eval(localStorage.getItem('claude_dev_assemble_userscript'));
```

### GM_* APIs During Development

GM_* functions are not available when running code via `javascript_tool` or `eval()` in the page context. Strategies:

- **Design around it:** Structure the script so most logic (DOM manipulation, CSS injection, event handling, observers) doesn't need GM_* at all
- **Stub when needed:** For chunks that must reference GM_* during testing:
  ```javascript
  const GM_getValue = (key, def) => def;
  const GM_setValue = (key, val) => console.log('[STUB] GM_setValue:', key, val);
  const GM_addStyle = (css) => { const s = document.createElement('style'); s.textContent = css; document.head.appendChild(s); return s; };
  ```
- **Defer GM_* integration:** Add the GM_* layer (persistent storage, cross-origin requests, menu commands) after the core functionality works. This layer is typically thin and can be verified during in-manager testing

### Common Chunk Patterns

**CSS injection:**
```javascript
(function() {
    const style = document.createElement('style');
    style.id = 'x-userjs-myscript-styles';
    style.textContent = `
        .unwanted { display: none !important; }
        #target { position: fixed !important; }
    `;
    document.head.appendChild(style);
    return 'Styles injected';
})();
```

**DOM manipulation:**
```javascript
(function() {
    document.querySelectorAll('.unwanted').forEach(el => el.style.display = 'none');
    const label = document.querySelector('#myLabel');
    if (label) label.textContent = 'New Label';
    return 'Elements modified';
})();
```

**Keyboard shortcuts:**
```javascript
(function() {
    document.addEventListener('keydown', function(e) {
        if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
            e.preventDefault();
            myFunction();
        }
    });
    return 'Keyboard shortcuts added';
})();
```

**Waiting for elements:**
```javascript
(function() {
    setTimeout(() => {
        const el = document.querySelector('.dynamic-element');
        if (el) {
            // Do something
        }
    }, 500);
    return 'Deferred setup scheduled';
})();
```

### Before Declaring Done

- **Verify by reloading** — navigate to the original URL and run the assembled script from scratch
- **Test the intended functionality** — don't assume, check
- **Take screenshots** at key stages, especially the final result
- **Look for discrepancies** between expected and actual behavior
- **Guide the user to retrieve the code** — do not dump the script into chat. Instead:
  ```javascript
  // User runs this in DevTools console:
  copy(eval(localStorage.getItem('claude_dev_assemble_userscript')));
  ```

### Userscript Publishing

If the user asks for help with publishing the userscript, read this guide document for detailed instructions:

https://gist.github.com/mike-clark-8192/0c2e3e7fa248c8c6688094b5d5ac9597

## Starter Template

This template embodies the development principles — scoped closure, debug logging, DOM query helpers, XPath support, and a persistent MutationObserver. Start every userscript from this skeleton:

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

Adapt for each script. Add `@grant` declarations and GM_* calls as needed.

## Writing the Script

### Metadata Block

Every userscript begins with a `==UserScript==` metadata block. Essential tags:

| Tag | Purpose | Notes |
|-----|---------|-------|
| `@name` | Script identifier | Unique within namespace |
| `@match` | URL pattern | Always prefer over `@include` |
| `@grant` | API permissions | `none` for minimal sandbox; add specific GM_* as needed |
| `@version` | Semantic version | Required for auto-updates |
| `@run-at` | Injection timing | `document-idle` (default safe), `document-end`, `document-start` |

**@match quick reference:**
- `*://www.example.com/*` — http and https, specific domain
- `*://*.example.com/*` — all subdomains
- Multiple `@match` lines for multiple patterns

For the complete tag reference, read `references/metadata-block.md`.

### Permissions

Start with `@grant none` and add permissions only as needed:

| Task | Required Grants |
|------|----------------|
| Modify page CSS | `@grant GM_addStyle` |
| Store persistent data | `@grant GM_getValue` + `@grant GM_setValue` |
| Cross-origin API calls | `@grant GM_xmlhttpRequest` + `@connect targetdomain.com` |
| Add menu commands | `@grant GM_registerMenuCommand` |
| Access page JS objects | `@grant unsafeWindow` |

When `@grant` specifies any value other than `none`, the script runs in a sandbox. With `@grant none`, the script shares the page's JavaScript context directly.

For the full API reference, read `references/gm-api.md`.

### Script Body Patterns

Select the appropriate pattern for the task:

| Scenario | Reference File |
|----------|---------------|
| CSS injection, element creation, CSP bypass | `references/css-and-dom-injection.md` |
| SPA sites, dynamic DOM, MutationObserver | `references/spa-and-dynamic-dom.md` |
| Cross-origin requests, CORS bypass | `references/cross-origin-and-network.md` |
| Persistent storage and state | `references/gm-api.md` (Storage section) |
| Security review, unsafeWindow, SRI | `references/security.md` |
| Manager differences, MV3, compatibility | `references/manager-compatibility.md` |
| Development workflow, testing, optimization | `references/practical-guidance.md` |

### Edge Case Checklist

Review before finalizing:

- [ ] **Iframes**: Add `@noframes` unless the script must run inside iframes
- [ ] **Timing**: Verify `@run-at` matches the use case — `document-start` has no DOM; `document-idle` waits for full load
- [ ] **External domains**: Add `@connect` for every domain accessed via `GM_xmlhttpRequest`
- [ ] **Dependency integrity**: Add SRI hashes to `@require` and `@resource` URLs
- [ ] **SPA sites**: Match the entire domain and handle route changes in code
- [ ] **CSP**: If the target site has a strict Content Security Policy, use `GM_addStyle`/`GM_addElement` instead of inline injection

## Console Testing (Non-Agentic)

When browser automation tools are not available, or for acceptance testing with the user after the agentic workflow:

1. Paste the script body (without the metadata block) into the browser's DevTools console on the target page
2. Stub GM_* calls as needed (see stubs in the GM_* APIs During Development section above)
3. Fix issues found during console testing
4. User installs the full script in Tampermonkey/Violentmonkey and reports back

Note: GM_* APIs are not available in the console. Keep the GM_* surface small so stubbing is easy.

## Common Mistakes

1. **Using `@include` instead of `@match`** — `@match` is stricter and safer
2. **Forgetting `@connect`** — `GM_xmlhttpRequest` silently fails without a matching `@connect`
3. **Using `@grant none` then calling GM_* functions** — no GM_* APIs available with `@grant none` (except `GM_info`)
4. **Not handling SPA navigation** — scripts only execute on "hard" navigations; SPA route changes need MutationObserver or URL change listeners
5. **`@run-at document-start` with DOM operations** — the DOM does not exist yet at `document-start`
6. **Missing `@noframes`** — without it, the script runs in every iframe on the page
7. **`@require` without version pinning** — unpinned CDN URLs can serve breaking changes; always pin and add SRI hash

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
| Legacy escaping workarounds (Claude Chrome) | `references/legacy-escaping.md` |

## Examples

Working example scripts in `examples/`:

- **`examples/basic-dom-modifier.js`** — Hide elements and inject custom CSS on a target site
- **`examples/spa-observer.js`** — SPA-aware script with MutationObserver lifecycle management
- **`examples/api-fetcher.js`** — Cross-origin API call with GM_xmlhttpRequest and floating result panel
- **`examples/full-featured.js`** — Menu commands, persistent storage, CSS injection, and notifications
