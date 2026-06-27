# SPA and Dynamic DOM Patterns

## The Problem

Userscripts execute only during "hard" page navigations — when the browser actually loads a new document. Single-Page Applications (SPAs) like YouTube, GitHub, Twitter/X, Reddit, Facebook, and most modern web apps use client-side routing. After the initial page load, navigation happens via JavaScript (pushState/replaceState) without triggering a new page load. This means:

- A userscript with `@match *://www.youtube.com/watch*` will NOT re-execute when navigating from the homepage to a video page
- The script fires once on initial hard load, then never again as the user navigates within the SPA
- DOM elements the script targets may not exist yet, or may be destroyed and recreated during navigation

## Strategy: Match Broadly, Filter in Code

For SPA sites, match the entire domain rather than specific paths:
```javascript
// @match *://www.youtube.com/*
```

Then handle route-specific logic in the script body by checking `window.location` and responding to URL changes.

## Pattern 1: MutationObserver (Cross-Manager)

The most reliable and portable approach. Works in all managers.

```javascript
// Wait for a specific element to appear
function waitForElement(selector, callback) {
  const existing = document.querySelector(selector);
  if (existing) {
    callback(existing);
    return;
  }

  const observer = new MutationObserver((mutations, obs) => {
    const el = document.querySelector(selector);
    if (el) {
      obs.disconnect();
      callback(el);
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
}
```

### Lifecycle Management

For scripts that need to clean up and reinitialize on SPA navigation:

```javascript
let currentCleanup = null;

function initForPage() {
  // Clean up previous instance
  if (currentCleanup) {
    currentCleanup();
    currentCleanup = null;
  }

  // Check if we're on the right page
  if (!window.location.pathname.startsWith('/watch')) return;

  // Set up for current page
  const observer = new MutationObserver(() => {
    // React to DOM changes
  });
  observer.observe(document.querySelector('#content'), {
    childList: true,
    subtree: true
  });

  // Register cleanup
  currentCleanup = () => {
    observer.disconnect();
    // Remove any injected elements, event listeners, etc.
  };
}

// Run on initial load
initForPage();

// Re-run on SPA navigation (see patterns below)
```

### Performance Guidelines

- **Target specific nodes**: Observe the narrowest possible parent, not `document.body`, when the target's container is known
- **Disconnect when done**: Always call `observer.disconnect()` after finding the target element or when the script's work is complete
- **Avoid heavy callbacks**: MutationObserver fires frequently on dynamic pages. Keep callback logic minimal — check for the target element and exit early if not found
- **Use `childList: true, subtree: true`** as the standard config. Avoid `attributes: true` or `characterData: true` unless specifically needed, as they generate many more mutations

## Pattern 2: window.onurlchange (Tampermonkey Only)

Tampermonkey provides a dedicated API for detecting URL changes in SPAs. Simpler than MutationObserver for URL-based triggers.

```javascript
// @grant window.onurlchange

if (window.onurlchange !== undefined) {
  window.addEventListener('urlchange', (info) => {
    // info.url contains the new URL
    console.log('Navigated to:', info.url);
    initForPage();
  });
}
```

Fires on pushState, replaceState, and popstate events. Not available in Violentmonkey or Greasemonkey — use as an enhancement with a MutationObserver fallback.

## Pattern 3: VM.observe (Violentmonkey)

Violentmonkey provides a helper library that wraps MutationObserver with a cleaner API.

```javascript
// @require https://cdn.jsdelivr.net/npm/@violentmonkey/dom@2
```

```javascript
// Wait for element — returns disconnect function
const disconnect = VM.observe(document.body, () => {
  const node = document.querySelector('.target-element');
  if (node) {
    doSomethingWith(node);
    return true; // Returning true auto-disconnects
  }
});

// To manually disconnect later:
// disconnect();
```

The parent node (`document.body`) must exist before calling `VM.observe`. Do not use with `@run-at document-start`.

## Pattern 4: Navigation API / History Monitoring

Monitor the History API to detect when the SPA changes routes:

```javascript
// Intercept pushState and replaceState
const originalPushState = history.pushState;
const originalReplaceState = history.replaceState;

function onUrlChange() {
  // Handle the navigation
  initForPage();
}

history.pushState = function(...args) {
  originalPushState.apply(this, args);
  onUrlChange();
};

history.replaceState = function(...args) {
  originalReplaceState.apply(this, args);
  onUrlChange();
};

window.addEventListener('popstate', onUrlChange);
```

This approach requires `@grant none` or `unsafeWindow` to access the page's `history` object. With a sandbox (`@grant` anything other than none), wrap the history object access through `unsafeWindow`.

## Pattern 5: hashchange / popstate (Fallback)

For simpler SPAs using hash-based routing:

```javascript
window.addEventListener('hashchange', () => {
  initForPage();
});
```

For SPAs using the History API:

```javascript
window.addEventListener('popstate', () => {
  initForPage();
});
```

Note: `popstate` fires on back/forward navigation but NOT on `pushState`/`replaceState` calls. Combine with Pattern 4 for full coverage.

## Choosing the Right Pattern

| Scenario | Recommended Pattern | Notes |
|----------|-------------------|-------|
| Cross-manager, wait for specific element | Pattern 1 (MutationObserver) | Most portable |
| Tampermonkey only, URL-based trigger | Pattern 2 (window.onurlchange) | Simplest for TM users |
| Violentmonkey, wait for element | Pattern 3 (VM.observe) | Clean API wrapper |
| Need to intercept all navigations | Pattern 4 (History API) | Requires unsafeWindow or @grant none |
| Hash-based SPA routing | Pattern 5 (hashchange) | Simple, limited scope |
| Maximum compatibility | Pattern 1 + Pattern 2 as enhancement | Fallback chain |

## Common SPA Sites and Their Patterns

| Site | Routing Type | Key Containers | Notes |
|------|-------------|----------------|-------|
| YouTube | pushState | `#content`, `ytd-watch-flexy` | Frequent DOM recycling |
| GitHub | Turbo (pushState) | `#js-repo-pjax-container`, `main` | Uses Turbo for navigation |
| Twitter/X | pushState | `main[role="main"]`, `[data-testid]` | Heavy DOM virtualization |
| Reddit | pushState | `.Post`, `shreddit-app` | New Reddit is fully SPA |
| Facebook | pushState | `[role="main"]` | Complex lazy loading |
| Google Search | pushState in some views | `#search`, `#rso` | Partially SPA |

When targeting these sites, match the entire domain and use MutationObserver to detect content changes rather than relying on URL patterns alone.

## Anti-Patterns to Avoid

- **Polling with setInterval/setTimeout**: Wastes CPU, creates lag between element appearance and script action. Use MutationObserver instead.
- **Relying solely on @run-at for timing**: Only controls initial injection. Irrelevant for subsequent SPA navigations.
- **Observing document.body when a tighter target exists**: Generates unnecessary mutation callbacks.
- **Forgetting to disconnect observers**: Memory leak that compounds on each SPA navigation.
- **Not cleaning up on re-navigation**: Duplicate event listeners, injected elements, or observers accumulating.

## Combining Patterns for Robust SPA Handling

A production-ready approach often combines multiple patterns for maximum reliability:

```javascript
// ==UserScript==
// @name         Robust SPA Handler Example
// @match        *://www.example.com/*
// @grant        window.onurlchange
// ==/UserScript==

let currentCleanup = null;
let lastUrl = location.href;

function initForPage() {
  // Clean up previous instance
  if (currentCleanup) {
    currentCleanup();
    currentCleanup = null;
  }

  // Route-specific logic
  if (location.pathname.startsWith('/watch')) {
    waitForElement('#player', (player) => {
      // Modify player
      const button = document.createElement('button');
      button.textContent = 'Custom Action';
      player.appendChild(button);

      currentCleanup = () => {
        button.remove();
      };
    });
  }
}

function waitForElement(selector, callback) {
  const existing = document.querySelector(selector);
  if (existing) {
    callback(existing);
    return;
  }

  const observer = new MutationObserver(() => {
    const el = document.querySelector(selector);
    if (el) {
      observer.disconnect();
      callback(el);
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });

  // Add observer to cleanup
  const oldCleanup = currentCleanup;
  currentCleanup = () => {
    observer.disconnect();
    if (oldCleanup) oldCleanup();
  };
}

// Method 1: Tampermonkey's window.onurlchange
if (typeof window.onurlchange !== 'undefined') {
  window.addEventListener('urlchange', initForPage);
}

// Method 2: History API monitoring (fallback)
const originalPushState = history.pushState;
const originalReplaceState = history.replaceState;

history.pushState = function(...args) {
  originalPushState.apply(this, args);
  if (location.href !== lastUrl) {
    lastUrl = location.href;
    initForPage();
  }
};

history.replaceState = function(...args) {
  originalReplaceState.apply(this, args);
  if (location.href !== lastUrl) {
    lastUrl = location.href;
    initForPage();
  }
};

window.addEventListener('popstate', () => {
  if (location.href !== lastUrl) {
    lastUrl = location.href;
    initForPage();
  }
});

// Initial run
initForPage();
```

This pattern:
- Uses Tampermonkey's `window.onurlchange` when available
- Falls back to History API monitoring for other managers
- Prevents duplicate initialization with URL tracking
- Properly cleans up observers and injected elements
- Works across all major userscript managers

## Debugging SPA Navigation Issues

When a userscript fails to work after SPA navigation:

1. **Verify the script ran initially**: Add `console.log('Script loaded')` at the top level
2. **Check if navigation is detected**: Log inside the URL change handler
3. **Confirm elements exist when expected**: Log inside `waitForElement` callback
4. **Monitor for errors**: Check browser console for exceptions
5. **Inspect the DOM**: Use DevTools to verify target selectors are correct after navigation
6. **Test navigation types**: Try direct URL entry, back/forward buttons, and clicking links
7. **Check for sandbox issues**: If modifying `history`, ensure proper `@grant` settings

Common issues:
- **Element selector changed**: SPAs sometimes use different HTML structure on different routes
- **Timing race**: Script logic runs before the element appears. Add MutationObserver waiting.
- **Cleanup not happening**: Old event listeners or observers accumulate. Implement proper cleanup.
- **Sandbox blocking**: Accessing page's `history` without `unsafeWindow` or `@grant none`

## Advanced: Detecting Specific Framework Navigation

Some frameworks emit custom events that can be more reliable than generic history monitoring:

```javascript
// React Router (some versions)
window.addEventListener('popstate', initForPage);

// Turbo / Turbolinks (GitHub, Rails apps)
document.addEventListener('turbo:load', initForPage);
document.addEventListener('turbolinks:load', initForPage);

// Next.js
window.addEventListener('routeChangeComplete', initForPage);

// Angular
// No standard event — use MutationObserver or History API
```

Check the target site's framework documentation or inspect network/console activity to identify framework-specific navigation events. Combine with generic patterns as fallback.

## Performance Considerations for Heavy SPAs

Sites with frequent DOM mutations (Twitter, Reddit, YouTube) can trigger MutationObserver callbacks hundreds of times per second:

- **Debounce callbacks**: Delay action until mutations settle
```javascript
let debounceTimer;
const observer = new MutationObserver(() => {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    // Check for element
  }, 100);
});
```

- **Use more specific selectors**: `document.querySelector('#specific-id .child')` is faster than iterating through mutations
- **Disconnect immediately after finding target**: Avoid leaving observers running when not needed
- **Observe narrow DOM trees**: If you know the container, observe only that subtree
- **Avoid synchronous DOM manipulation in callbacks**: Queue changes with `requestAnimationFrame` or `setTimeout(fn, 0)`

For maximum performance on extremely dynamic sites, consider combining MutationObserver (for element appearance) with event delegation (for interactions) rather than attaching individual listeners to frequently-recreated elements.
