# CSS and DOM Injection

## CSS Injection Methods

### GM_addStyle (Recommended)

The simplest and most reliable method. Bypasses Content Security Policy.

```javascript
// @grant GM_addStyle

GM_addStyle(`
  .ad-banner { display: none !important; }
  .sidebar { width: 0 !important; }
  #header { background-color: #1a1a2e !important; }
`);
```

Returns the created `<style>` element for later reference or removal.

Use template literals (backticks) for multi-line CSS. Use `!important` to override page styles when necessary.

#### Removing Injected Styles

```javascript
const styleElement = GM_addStyle('.ad { display: none; }');

// Later, remove the styles:
styleElement.remove();
```

### GM_addElement for Style Tags

More control over placement:

```javascript
// @grant GM_addElement

GM_addElement('style', {
  textContent: '.ad-banner { display: none !important; }'
});

// Or append to a specific parent:
GM_addElement(document.head, 'style', {
  textContent: `
    .custom-panel {
      position: fixed;
      top: 10px;
      right: 10px;
    }
  `
});
```

Also bypasses CSP. Available in Tampermonkey 4.11+ and Violentmonkey v2.13.1+.

### @resource for External CSS

Load CSS files at install time and inject at runtime:

```
// @resource myCSS https://example.com/styles.css
// @grant GM_getResourceText
// @grant GM_addStyle
```

```javascript
const css = GM_getResourceText('myCSS');
GM_addStyle(css);
```

Benefits: CSS cached locally at install, no runtime fetch needed.

#### With Subresource Integrity

```
// @resource myCSS https://cdn.example.com/styles.css#sha256-abc123...
```

Ensures the CSS hasn't been tampered with since installation.

### Manual DOM Injection (Fallback)

When GM APIs are unavailable (`@grant none`):

```javascript
const style = document.createElement('style');
style.textContent = '.ad-banner { display: none; }';
document.head.appendChild(style);
```

Does NOT bypass CSP. May fail on sites with strict Content Security Policy.

## Element Creation and Injection

### Creating UI Elements

Standard DOM API pattern:

```javascript
const panel = document.createElement('div');
panel.id = 'my-userscript-panel';
panel.innerHTML = '<h3>My Panel</h3><p>Content here</p>'; // Safe when content is hardcoded
panel.style.cssText = 'position:fixed; top:10px; right:10px; z-index:99999; background:#fff; padding:10px; border:1px solid #ccc; border-radius:4px;';
document.body.appendChild(panel);
```

When building UI with dynamic content, use DOM methods instead of innerHTML:

```javascript
const panel = document.createElement('div');
const heading = document.createElement('h3');
heading.textContent = userProvidedText; // Safe — textContent doesn't parse HTML

const description = document.createElement('p');
description.textContent = 'Dynamic: ' + externalData;

panel.appendChild(heading);
panel.appendChild(description);
document.body.appendChild(panel);
```

### Creating Buttons

```javascript
const button = document.createElement('button');
button.textContent = 'Click Me';
button.style.cssText = 'padding: 8px 16px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer;';
button.addEventListener('click', function() {
  console.log('Button clicked');
});

document.body.appendChild(button);
```

### GM_addElement for Script Injection

Inject external scripts bypassing CSP:

```javascript
// @grant GM_addElement

GM_addElement('script', {
  src: 'https://example.com/library.js',
  type: 'text/javascript'
});
```

#### Inline Script Injection

```javascript
GM_addElement('script', {
  textContent: `
    console.log('This runs in page context');
    window.myPageFunction = function() {
      // Accessible to page scripts
    };
  `
});
```

#### Script Injection with Callback

```javascript
GM_addElement('script', {
  src: 'https://cdn.example.com/library.js',
  onload: function() {
    console.log('Library loaded');
  }
});
```

### Shadow DOM Access

GM_addElement can append to shadow roots:

```javascript
const shadowHost = document.querySelector('.shadow-host');
if (shadowHost && shadowHost.shadowRoot) {
  GM_addElement(shadowHost.shadowRoot, 'style', {
    textContent: '.internal-element { color: red; }'
  });
}
```

#### Traversing Shadow DOM

```javascript
function findInShadowDOM(selector) {
  const walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_ELEMENT
  );

  while (walker.nextNode()) {
    const node = walker.currentNode;
    if (node.shadowRoot) {
      const found = node.shadowRoot.querySelector(selector);
      if (found) return found;
    }
  }
  return null;
}

const element = findInShadowDOM('.hidden-button');
```

## Timing Considerations

| Method | Works at document-start? | Bypasses CSP? |
|--------|------------------------|---------------|
| GM_addStyle | No (needs DOM) | Yes |
| GM_addElement | No (needs DOM) | Yes |
| Manual DOM injection | No (needs DOM) | No |
| @resource + GM_addStyle | No (needs DOM) | Yes |

For earliest possible CSS injection, use `@run-at document-end` (not `document-start`). At `document-start`, no DOM elements exist — `document.head` and `document.body` are both null.

To inject CSS as early as possible, use `@run-at document-body` (fires when `<body>` first appears) combined with GM_addStyle.

### Waiting for DOM Elements

```javascript
function waitForElement(selector, timeout = 5000) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(selector)) {
      return resolve(document.querySelector(selector));
    }

    const observer = new MutationObserver(() => {
      const element = document.querySelector(selector);
      if (element) {
        observer.disconnect();
        resolve(element);
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    setTimeout(() => {
      observer.disconnect();
      reject(new Error('Element not found within timeout'));
    }, timeout);
  });
}

// Usage
waitForElement('.target-element')
  .then(element => {
    // Inject UI next to element
  })
  .catch(err => console.error(err));
```

## Responsive and Conditional Styles

### Media Queries

```javascript
GM_addStyle(`
  .my-panel {
    width: 300px;
  }

  @media (max-width: 768px) {
    .my-panel {
      width: 100%;
      position: static;
    }
  }
`);
```

### Dark Mode Detection

```javascript
if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
  GM_addStyle(`
    .my-panel {
      background: #1a1a1a;
      color: #e0e0e0;
    }
  `);
} else {
  GM_addStyle(`
    .my-panel {
      background: #ffffff;
      color: #333333;
    }
  `);
}
```

### Dynamic Theme Switching

```javascript
const darkStyles = GM_addStyle(`
  .my-panel { background: #1a1a1a; color: #e0e0e0; }
`);
darkStyles.disabled = true; // Start with light mode

function toggleDarkMode(enabled) {
  darkStyles.disabled = !enabled;
}
```

## Best Practices

- Namespace CSS selectors to avoid conflicts: prefix with a unique script identifier (e.g., `#myScript-panel`, `.myScript-button`)
- Use `!important` sparingly — only when overriding stubborn page styles
- Prefer `display: none !important` over `visibility: hidden` for hiding elements (hidden elements still take up space)
- For responsive styles, media queries work inside GM_addStyle
- Clean up injected elements on SPA navigation to prevent accumulation
- Use `z-index: 99999` or higher for floating UI to stay above page content

### Namespacing Pattern

```javascript
const SCRIPT_PREFIX = 'myScript';

GM_addStyle(`
  #${SCRIPT_PREFIX}-panel {
    /* styles */
  }
  .${SCRIPT_PREFIX}-button {
    /* styles */
  }
`);

const panel = document.createElement('div');
panel.id = `${SCRIPT_PREFIX}-panel`;
```

### Cleanup on SPA Navigation

```javascript
let injectedElements = [];

function injectUI() {
  const panel = document.createElement('div');
  panel.className = 'myScript-panel';
  document.body.appendChild(panel);
  injectedElements.push(panel);
}

// Clean up when page changes (SPA navigation)
let lastUrl = location.href;
new MutationObserver(() => {
  if (location.href !== lastUrl) {
    lastUrl = location.href;
    injectedElements.forEach(el => el.remove());
    injectedElements = [];
    injectUI(); // Re-inject for new page
  }
}).observe(document, { subtree: true, childList: true });
```

### Avoiding Style Conflicts

```javascript
// Isolate styles with high specificity
GM_addStyle(`
  div#myScript-panel.myScript-ui {
    font-family: Arial, sans-serif !important;
    font-size: 14px !important;
  }

  /* Reset inherited styles */
  #myScript-panel * {
    all: initial;
  }

  #myScript-panel button {
    display: inline-block;
    padding: 8px;
    /* re-declare needed styles */
  }
`);
```

## Advanced Techniques

### CSS Variables for Theming

```javascript
GM_addStyle(`
  :root {
    --myScript-primary: #007bff;
    --myScript-bg: #ffffff;
    --myScript-text: #333333;
  }

  .myScript-panel {
    background: var(--myScript-bg);
    color: var(--myScript-text);
  }

  .myScript-button {
    background: var(--myScript-primary);
  }
`);

// Change theme dynamically
document.documentElement.style.setProperty('--myScript-primary', '#28a745');
```

### Injecting SVG Icons

```javascript
const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
icon.setAttribute('width', '24');
icon.setAttribute('height', '24');
icon.setAttribute('viewBox', '0 0 24 24');
icon.innerHTML = '<path d="M12 2L2 7v10l10 5 10-5V7z"/>';

button.appendChild(icon);
```
