# Research Notes: Userscript Development

## Key Findings

### Manager Compatibility (as of early 2026)
- **Tampermonkey**: Most popular, migrated to MV3, requires Developer Mode in Chrome
- **Violentmonkey**: NOT migrated to MV3, broken on Chrome as of mid-2025, works on Firefox/Brave
- **Greasemonkey**: GM4 async-only API, limited compatibility, Firefox only

### API Styles
- `GM_*` (callback, synchronous-ish) — Tampermonkey primary, VM supports
- `GM.*` (Promise-based) — Greasemonkey4 primary, VM supports since 2.12.0
- For max compatibility: use `GM_*` style (works in TM + VM)

### Critical Patterns for Userscripts

#### 1. SPA Handling
- SPAs don't trigger real navigation — scripts only run on "hard" navigations
- Match entire domain, then use MutationObserver or `window.onurlchange` to detect route changes
- `window.onurlchange` requires `@grant window.onurlchange` (Tampermonkey)

#### 2. MutationObserver Best Practices
- Use instead of polling/timers
- Always disconnect when done
- Target specific nodes, not document.body when possible
- VM helper: `@require @violentmonkey/dom@2` → `VM.observe()`

#### 3. CSS Injection
- `GM_addStyle(css)` — simplest, bypasses CSP
- `GM_addElement('style', {textContent: css})` — more control
- `@resource` + `GM_getResourceText` for external CSS

#### 4. Cross-Origin Requests
- `GM_xmlhttpRequest` bypasses CORS (runs from background script)
- Must declare `@grant GM_xmlhttpRequest` AND `@connect domain.com`
- MV3 challenges: some forbidden headers may not work in Chrome

#### 5. @run-at Timing
- `document-start`: Before DOM exists — can intercept early
- `document-end` (default): DOM ready, resources may still be loading
- `document-idle`: After full page load
- `document-body`: As soon as body element exists

#### 6. Injection Contexts (VM)
- `page`: Full access to page JS objects, `unsafeWindow` works
- `content`: Isolated world, no page JS access, CSP-safe
- `auto`: Try page first, fall back to content

#### 7. Security Concerns
- Never use `eval()` or `innerHTML` with untrusted data
- `unsafeWindow` exposes page's actual window — page scripts can manipulate it
- Validate all data from external sources
- Use SRI hashes for `@require`/`@resource`

### @match Pattern Syntax
- Format: `scheme://host/path` (ignores query/hash)
- `*` in scheme: matches http and https
- `*.example.com`: matches example.com and all subdomains
- `.tld` suffix: matches any TLD (`google.tld` → google.com, google.co.jp, etc.)
- Prefer `@match` over `@include` (stricter, safer)

### Manifest V3 Impact
- Chrome requires Developer Mode for userscript execution
- Tampermonkey has migrated; Violentmonkey has NOT
- Firefox unaffected
- Some header manipulation features may not work in Chrome MV3
