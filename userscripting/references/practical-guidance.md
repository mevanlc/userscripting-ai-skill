# Practical Development Guidance

## The Console-First Development Workflow

Before writing a single line in the userscript file, experiment in the browser's DevTools console on the target page.

1. **Explore the DOM** — run `document.querySelector` experiments to find stable selectors. Try multiple approaches. Inspect the element tree for semantic landmarks, ARIA roles, and stable-looking IDs.
2. **Prototype the core logic** — paste a few lines into the console and verify they work. This is free and instant — no install/reload cycle.
3. **Build up incrementally** — once individual pieces work in the console, combine them into the script body.
4. **Test the full script body** — paste the complete script body (without the `==UserScript==` block) into the console. Stub GM_* functions:
```javascript
// Minimal stubs for console testing
const GM_getValue = (key, def) => def;
const GM_setValue = (key, val) => console.log('[STUB] GM_setValue:', key, val);
const GM_addStyle = (css) => { const s = document.createElement('style'); s.textContent = css; document.head.appendChild(s); return s; };
```
5. **Hand off for in-manager testing** — once the script works in-console, wrap it in the metadata block and pass to the user for Tampermonkey/Violentmonkey installation. Fix issues reported from this phase immediately.

## The logdebug Pattern

Define a debug logging function at the top of every script:

```javascript
const DEBUG = true;
const SCRIPT_NAME = 'MyScript';
function logdebug(...args) {
  if (DEBUG) console.log(`[${SCRIPT_NAME}]`, ...args);
}
```

Use `logdebug` at every significant decision point:
- When the MutationObserver fires and finds (or doesn't find) a target element
- When a GM_xmlhttpRequest completes
- When the script initializes or re-initializes after SPA navigation
- When user preferences are loaded or changed

The user (or a future maintainer) can flip `DEBUG = false` for production use and re-enable it when debugging future issues.

For errors that indicate something is genuinely wrong (not just debug info), use `console.warn` or `console.error` with the script name prefix regardless of the DEBUG flag:

```javascript
function logwarn(...args) { console.warn(`[${SCRIPT_NAME}]`, ...args); }
function logerror(...args) { console.error(`[${SCRIPT_NAME}]`, ...args); }
```

## Exception Handling Strategy

### Top-Level Protection

Wrap the main initialization in a try/catch. A userscript that logs an error and does nothing is better than one that throws an uncaught exception that disrupts the page:

```javascript
(function() {
  'use strict';
  try {
    init();
  } catch (e) {
    console.error('[MyScript] Fatal initialization error:', e);
  }
})();
```

### Granular Protection

Protect individual features independently so one failure doesn't take down the whole script:

```javascript
function init() {
  try { setupStyles(); } catch (e) { logerror('Style injection failed:', e); }
  try { setupObserver(); } catch (e) { logerror('Observer setup failed:', e); }
  try { setupMenuCommands(); } catch (e) { logerror('Menu setup failed:', e); }
}
```

### What to Catch vs. What to Let Fail

- **Catch and log:** DOM operations (elements may not exist), GM_xmlhttpRequest callbacks (server may return unexpected data), JSON parsing of external data
- **Catch and suppress (logdebug only):** Expected failures in tight loops — e.g., MutationObserver callback checking for an element that usually isn't there yet
- **Never catch:** Programming errors during development (let them surface in the console for fast debugging). Only add catch blocks for production robustness after the logic is working.

## @run-at Pragmatics

`document-idle` is the default position. It is correct for the vast majority of scripts.

`document-start` is reserved for a specific class of problems:
- Intercepting or blocking page scripts before they execute
- Overriding page-level JavaScript functions before the page uses them
- Modifying request behavior or headers before the page makes its first requests

If the problem doesn't require running code before the page's own code, `document-start` is an antipattern — it forces dealing with a nonexistent DOM and adds complexity for no benefit.

`document-end` is a middle ground — DOM is ready but some resources (images, iframes) may still be loading. Use when `document-idle` causes a visible flash of unmodified content that matters to the user experience.

## Working With vs. Against the Page

For each feature, consider two approaches:

**Working with the page's primitives:**
- Modify existing elements (add classes, change attributes, move nodes)
- Hook into the page's existing CSS variables or theme system
- Use the page's own event system when possible
- Result: smaller script, more likely to survive site updates, looks native

**Taking over with injected code:**
- Create entirely new UI elements and stylesheets
- Build independent functionality that doesn't depend on page internals
- Result: more control, less fragile when page structure changes, but looks foreign unless effort is put into style matching

Neither approach is universally better. Often a single script uses both — working with the page for layout adjustments while injecting new UI for added features. Choose based on:
- How stable is the page element being modified? (Stable → work with it)
- How complex is the new functionality? (Complex → inject new UI)
- How important is visual integration? (Important → work with page styles)

## Page Layout Coherence

When moving elements, hiding sections, or restructuring page layout, don't laser-focus on the single element being modified. Consider the larger page structure:

- Will removing this element leave an awkward gap or break a flex/grid layout?
- Will moving this element orphan a label, heading, or related content?
- Does the surrounding container depend on this element for sizing or positioning?
- Will the change look correct at different viewport widths?

Test the page after modifications by scrolling through it, resizing the window, and interacting with nearby features. A moved element that works in isolation but breaks the page flow is not a working solution.

## Selector Stability Deep Dive

### Identifying Stable Selectors

Inspect the target page's DOM and look for:

1. **Semantic HTML elements** — `<article>`, `<nav>`, `<header>`, `<footer>`, `<main>`, `<aside>`, `<section>`. These are the most stable anchors because they reflect the page's structural intent, not its styling.

2. **ARIA attributes** — `[role="dialog"]`, `[aria-label="Search"]`, `[aria-expanded="true"]`. ARIA attributes are accessibility commitments — sites are unlikely to remove them.

3. **Intentional data attributes** — `[data-testid="user-profile"]`, `[data-section="comments"]`. If a `data-testid` looks human-written and descriptive, it was placed intentionally (often for the site's own testing) and is likely stable.

4. **Meaningful IDs** — `#main-content`, `#comment-section`. IDs that describe purpose tend to be stable. IDs that look generated (`#__next`, `#root`) are stable but not specific enough to be useful selectors.

5. **Descriptive class names** — `.comment-body`, `.user-avatar`, `.nav-link`. Human-authored class names that describe what the element is (not how it looks) are reasonably stable.

### Identifying Fragile Selectors

Avoid:
- Framework-generated class names: `.css-1a2b3c`, `._3xKp2`, `.MuiButton-root` (Material UI classes are semi-stable but version-dependent)
- Positional selectors: `div > div > div:nth-child(3)` — any structural change breaks this
- Style-oriented classes: `.mt-4`, `.flex`, `.text-lg` — Tailwind/utility classes change whenever the design changes
- Auto-generated IDs: `#ember123`, `#rc-anchor-container`

### The Signature Pattern

Sometimes framework-generated classes are unavoidable. When they must be used, combine multiple classes or attributes into a "signature" that's unlikely to coincidentally appear elsewhere:

```javascript
// Fragile: single generated class
document.querySelector('.css-1a2b3c');

// More stable: signature combination
document.querySelector('div[class*="UserProfile"][data-testid]');
// Or combining stable parent with fragile child
document.querySelector('article .css-1a2b3c');
```

## Namespace Discipline

### Element Naming

Prefix all injected element IDs and class names with `x-userjs-` (or a script-specific prefix):

```javascript
const PREFIX = 'x-userjs-myscript';
panel.id = `${PREFIX}-panel`;
panel.className = `${PREFIX}-container`;
button.className = `${PREFIX}-btn`;
```

This prevents collisions with the page's own IDs and classes, and makes it easy to identify (and clean up) injected elements.

### Variable Scoping

Always wrap the script body in an IIFE or use `'use strict'` with block scoping:

```javascript
(function() {
  'use strict';
  // All variables and functions are scoped here
  // Nothing leaks to window
})();
```

If a value genuinely needs to be on `window` (e.g., for communication with injected page scripts), do it explicitly:

```javascript
window.__myUserscript_api = { toggle: toggleFeature };
```

### CSS Scoping

Prefix all injected CSS rules:

```javascript
GM_addStyle(`
  .x-userjs-myscript-panel { /* ... */ }
  .x-userjs-myscript-btn { /* ... */ }
`);
```

## Optimization Philosophy

Do not pre-optimize. Do not build caches, debounce systems, or complex state management before they're needed. These add debugging complexity and often solve problems that don't exist.

Let performance issues reveal themselves during development:
- If the MutationObserver callback is visibly slow, then add debouncing
- If repeated DOM queries are causing jank, then cache references
- If storage reads are a bottleneck (they almost never are), then add a local cache

The right time to optimize is when a specific, observable problem occurs — not before.

## Storage Hygiene

Store only user preferences and configuration in `GM_setValue`. Do not store:
- Data derived from the page (recompute it)
- Cached API responses (re-fetch or let the browser cache handle it)
- Large data structures that grow over time without bounds

Keep stored keys to a minimum. Name them descriptively:

```javascript
GM_setValue('darkMode', true);           // Good: clear preference
GM_setValue('lastSyncTimestamp', Date.now()); // Good: small, bounded
GM_setValue('allPosts', hugeArray);       // Bad: unbounded growth
```
