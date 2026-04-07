# ULTRAPLAN: UserScripting Skill for Claude Code

## Goal

Create a Claude Code Skill that enables Claude to write high-quality UserScripts (Tampermonkey/Violentmonkey/Greasemonkey). The skill should encode the procedural knowledge, API awareness, and pattern library needed to produce scripts that work correctly across managers, handle modern web patterns (SPAs, CSP, dynamic DOM), and avoid common pitfalls. The user is handling trigger/discoverability — this plan focuses on the **post-discovery progressive disclosure structure**.

## Key Findings

### On Skill Design (from Anthropic's official skills + community best practices)

1. **Three-tier progressive disclosure is the proven pattern:**
   - Tier 1: Metadata (name + description, ~100 words, always in context)
   - Tier 2: SKILL.md body (loaded when triggered, target 1500-2000 words)
   - Tier 3: Reference files, examples, scripts (loaded as needed, unlimited)

2. **SKILL.md serves as a navigation hub**, not an encyclopedia. It provides:
   - Core workflow/decision tree
   - Essential patterns (the things Claude needs for every userscript)
   - Explicit pointers to deeper reference files
   - The "what" and "when" of each reference file so Claude can select correctly

3. **Reference files carry the depth.** Anthropic's own skills show reference files 2-4x larger than SKILL.md. The `mcp-builder` skill is a good template: lean core + framework-specific guides split by variant.

4. **Writing style:** Imperative/infinitive form throughout. Third-person in description. No "you should" — just "do X."

5. **Conditional loading instructions** work well: "If the user needs cross-origin requests, read `references/cross-origin.md`" vs. "MANDATORY - READ ENTIRE FILE" for critical docs.

### On UserScript Development (from Tampermonkey docs, ViolentMonkey docs, community guides)

1. **Manager landscape (early 2026):**
   - Tampermonkey: MV3 migrated, requires Developer Mode in Chrome, most popular
   - Violentmonkey: NOT MV3 migrated, broken on Chrome, works on Firefox/Brave
   - Greasemonkey: Firefox-only, GM4 async-only API, niche
   - Pragmatic default: target `GM_*` callback API (works in TM + VM)

2. **SPA handling is the #1 pain point.** Scripts only run on "hard" navigations. For SPAs (YouTube, GitHub, Twitter, etc.), must match entire domain and use MutationObserver or `window.onurlchange` to detect route changes.

3. **Key API categories for a skill to cover:**
   - Metadata block (`@match`, `@grant`, `@run-at`, `@require`, `@resource`, `@connect`, `@noframes`)
   - Storage (`GM_getValue`/`GM_setValue` + batch variants)
   - DOM manipulation (`GM_addStyle`, `GM_addElement` — both bypass CSP)
   - Cross-origin requests (`GM_xmlhttpRequest` + `@connect`)
   - UI (`GM_registerMenuCommand`, `GM_notification`, `GM_openInTab`)
   - Resources (`GM_getResourceText`, `GM_getResourceURL`)

4. **Security considerations are non-trivial:**
   - `unsafeWindow` exposes page's actual window — page scripts can manipulate values
   - Never use `eval()`/`innerHTML` with untrusted data
   - Use SRI hashes on `@require`/`@resource` for dependency integrity
   - `@grant none` disables sandbox — only use when truly needed

5. **@match pattern syntax** has nuances: wildcards in scheme (`*://`), host (`*.example.com`), `.tld` suffix for all TLDs, ignores query/hash.

6. **Injection timing matters:**
   - `document-start`: Before DOM — can intercept early but no DOM APIs
   - `document-end`: DOM ready (default)
   - `document-idle`: After full page load
   - `document-body`: As soon as `<body>` exists

### References

- [Tampermonkey API Documentation](https://www.tampermonkey.net/documentation.php)
- [Violentmonkey GM API](https://violentmonkey.github.io/api/gm/)
- [Violentmonkey Metadata Block](https://violentmonkey.github.io/api/metadata-block/)
- [Violentmonkey Matching Rules](https://violentmonkey.github.io/api/matching/)
- [Violentmonkey DOM Observation Guide](https://violentmonkey.github.io/guide/observing-dom/)
- [Violentmonkey Injection Contexts](https://violentmonkey.github.io/posts/inject-into-context/)
- [Greasespot Wiki - Metadata Block](https://wiki.greasespot.net/Metadata_Block)
- [Anthropic Skills Repo](https://github.com/anthropics/skills)
- [Anthropic Blog - Agent Skills](https://claude.com/blog/equipping-agents-for-the-real-world-with-agent-skills)
- [Skill Authoring Best Practices - Claude Docs](https://docs.claude.com/en/docs/agents-and-tools/agent-skills/best-practices)
- [Progressive Disclosure for AI Coding Tools](https://alexop.dev/posts/stop-bloating-your-claude-md-progressive-disclosure-ai-coding-tools/)
- [Skills Deep Dive](https://leehanchung.github.io/blogs/2025/10/26/claude-skills-deep-dive/)

---

## Approach

### Progressive Disclosure Architecture

The skill uses a **hub-and-spoke model** where SKILL.md is the hub (always loaded when triggered) and reference files are spokes (loaded conditionally based on what the user is building).

```
userscripting/
├── SKILL.md                          (~1800 words — core workflow + navigation)
├── references/
│   ├── metadata-block.md             (~2500 words — complete @tag reference)
│   ├── gm-api.md                     (~3000 words — full GM_* API reference)
│   ├── spa-and-dynamic-dom.md        (~1500 words — SPA patterns, MutationObserver)
│   ├── cross-origin-and-network.md   (~1200 words — GM_xmlhttpRequest, @connect, CORS)
│   ├── css-and-dom-injection.md      (~1000 words — GM_addStyle, GM_addElement, CSP)
│   ├── security.md                   (~800 words — unsafeWindow, SRI, eval dangers)
│   └── manager-compatibility.md      (~1000 words — TM vs VM vs GM, MV3 status, API styles)
├── examples/
│   ├── basic-dom-modifier.js         (simple script: hide elements, add styles)
│   ├── spa-observer.js               (SPA-aware script with MutationObserver)
│   ├── api-fetcher.js                (cross-origin API call with GM_xmlhttpRequest)
│   └── full-featured.js              (menu commands, storage, notifications, CSS)
└── scripts/
    └── validate-metadata.sh          (check metadata block for common errors)
```

### Why This Structure

**SKILL.md (the hub)** contains:
- A decision tree / workflow for writing a userscript (metadata → grants → code → test)
- The most essential patterns Claude needs for *every* script (metadata template, @match basics, @grant basics)
- A "reference map" telling Claude which reference file to load for which scenario
- Common mistakes checklist (quick-reference, not deep)

**References (the spokes)** contain the depth:
- `metadata-block.md`: Complete tag reference with all options, cross-manager notes, pattern syntax details. Loaded for any non-trivial metadata question.
- `gm-api.md`: Full function reference with signatures, parameters, return values, and usage notes. Loaded when Claude needs to use specific GM functions.
- `spa-and-dynamic-dom.md`: MutationObserver patterns, `window.onurlchange`, VM.observe, SPA site detection heuristics. Loaded when the target site is an SPA or has dynamic content.
- `cross-origin-and-network.md`: GM_xmlhttpRequest patterns, @connect requirements, response handling, MV3 header limitations. Loaded when the script needs to call external APIs.
- `css-and-dom-injection.md`: GM_addStyle, GM_addElement, @resource for external CSS, CSP bypass patterns, shadow DOM considerations. Loaded when the script modifies page appearance.
- `security.md`: unsafeWindow risks, innerHTML/eval alternatives, SRI for dependencies, @grant none implications. Could be loaded as a final review step.
- `manager-compatibility.md`: TM vs VM vs GM differences, MV3 status, GM_* vs GM.* API styles, polyfill options. Loaded when targeting specific managers or needing broad compatibility.

**Examples** serve as templates Claude can adapt rather than writing from scratch. Each demonstrates a different common pattern.

**Scripts** provide deterministic validation rather than relying on Claude to catch metadata errors.

### Alternatives Considered

1. **Fewer, larger reference files** (e.g., one big `api-reference.md`): Rejected because Claude would load the full GM API when it only needs the metadata block section. Smaller, topic-focused files let Claude load exactly what's needed.

2. **More content in SKILL.md** (e.g., inline the metadata template with full tag descriptions): Rejected because this would push SKILL.md past 3000 words. The metadata template in SKILL.md should be a quick-reference skeleton; the full tag reference lives in `references/metadata-block.md`.

3. **No examples directory** (just describe patterns in references): Rejected because complete, working examples are more reliable than descriptions when Claude is generating code. Examples also serve as implicit test cases.

---

## Task Breakdown

### Step 1: Create directory structure

```bash
mkdir -p userscripting/{references,examples,scripts}
```

### Step 2: Write SKILL.md (~1800 words)

The core file. Structure:

```
---
name: userscripting
description: [User will handle this — trigger/discoverability]
---

# UserScript Development

## Overview
[2-3 sentences: what userscripts are, what this skill provides]

## Workflow: Writing a UserScript

### 1. Define Metadata Block
[Skeleton template with the most common tags]
[Quick reference: @match, @grant, @run-at — just enough to get started]
[→ For complete tag reference, read `references/metadata-block.md`]

### 2. Determine Required Permissions
[@grant decision tree: none vs specific grants]
[Common grant combinations for common tasks]
[→ For full API reference, read `references/gm-api.md`]

### 3. Write the Script Body
[Key patterns summary — one paragraph each, with pointers:]
- DOM modification → `references/css-and-dom-injection.md`
- SPA/dynamic content → `references/spa-and-dynamic-dom.md`
- Cross-origin requests → `references/cross-origin-and-network.md`
- Storage/state → covered in `references/gm-api.md` (Storage section)

### 4. Handle Edge Cases
[Quick checklist:]
- @noframes if not needed in iframes
- @run-at timing for the use case
- @connect for any external domains
- SRI hashes for @require/@resource

### 5. Review
[→ Run `scripts/validate-metadata.sh` against the script]
[→ Consult `references/security.md` for security review]
[→ Check `references/manager-compatibility.md` if targeting specific managers]

## Common Mistakes
[Bullet list of top 5-7 mistakes with one-line fixes — NOT deep explanations]

## Reference Map
[Table mapping scenario → reference file]

## Examples
[List of example files with one-line descriptions]
```

### Step 3: Write `references/metadata-block.md` (~2500 words)

Complete @tag reference. For each tag:
- Syntax and accepted values
- Cross-manager compatibility notes (TM/VM/GM)
- Common mistakes
- Examples

Special sections for:
- @match pattern syntax (wildcards, .tld, scheme matching)
- @match vs @include (when to use which — short answer: always @match)
- @grant permission model
- @run-at timing model with diagram/table
- @require and @resource with SRI
- @require guidance: prefer native API solutions; only @require libraries that are high-impact to the task

### Step 4: Write `references/gm-api.md` (~3000 words)

Full GM_* API reference organized by category:
- Storage (GM_getValue, GM_setValue, batch variants, listeners)
- DOM (GM_addStyle, GM_addElement)
- Network (GM_xmlhttpRequest — just signatures here, deep patterns in cross-origin ref)
- UI (GM_registerMenuCommand, GM_notification, GM_openInTab, GM_setClipboard)
- Resources (GM_getResourceText, GM_getResourceURL)
- Info (GM_info object structure)
- Tab management (GM_getTab, GM_saveTab, GM_getTabs)

For each function: signature, parameters, return value, `@grant` requirement, usage note.

Include a section on `GM.*` async variants for Greasemonkey4 compatibility.

### Step 5: Write `references/spa-and-dynamic-dom.md` (~1500 words)

- Why SPAs are problematic for userscripts (no real navigation events)
- Pattern 1: MutationObserver for element detection (with code)
- Pattern 2: `window.onurlchange` for Tampermonkey (with code)
- Pattern 3: VM.observe helper for Violentmonkey (with code)
- Pattern 4: Navigation API / popstate / hashchange fallbacks
- When to use which pattern
- Performance: disconnect observers, target specific nodes
- Common SPA sites and their routing patterns (YouTube, GitHub, Twitter)

### Step 6: Write `references/cross-origin-and-network.md` (~1200 words)

- GM_xmlhttpRequest vs fetch/XMLHttpRequest (why GM version bypasses CORS)
- Required metadata: `@grant GM_xmlhttpRequest` + `@connect`
- Request patterns: GET, POST with JSON, file download
- Response handling: status codes, responseType, error callbacks
- MV3 limitations: forbidden headers in Chrome
- GM_download for file saving

### Step 7: Write `references/css-and-dom-injection.md` (~1000 words)

- GM_addStyle: basic usage, CSP bypass, return value
- GM_addElement: creating arbitrary elements, shadow DOM access
- @resource + GM_getResourceText for external CSS
- Manual DOM injection as fallback
- Timing: why @run-at document-start breaks GM_addStyle
- Responsive styles and media queries in injected CSS

### Step 8: Write `references/security.md` (~800 words)

- unsafeWindow: what it exposes, when page scripts can exploit it
- Never use eval()/innerHTML with external data
- SRI for @require and @resource
- @grant none: what it means, when to use, sandbox implications
- Data from GM_xmlhttpRequest: treat as untrusted
- @connect: principle of least privilege
- Third-party script review guidelines

### Step 9: Write `references/manager-compatibility.md` (~1000 words)

- Manager comparison table: TM vs VM vs GM (features, API support, browser support)
- MV3 status: TM migrated, VM not, Firefox unaffected
- Developer Mode requirement in Chrome
- API style: GM_* vs GM.* — when to use which
- Polyfill options (gm4-polyfill, GMCommonAPI.js)
- Pragmatic recommendation: target GM_* for broad compatibility
- Browser-specific notes (Chrome, Firefox, Brave, Edge) — no Safari coverage

### Step 10: Write example scripts

**`examples/basic-dom-modifier.js`** — A simple script that:
- Hides specific elements on a site
- Adds custom CSS
- Uses @match, @grant GM_addStyle, @run-at document-idle

**`examples/spa-observer.js`** — An SPA-aware script that:
- Matches YouTube or similar SPA
- Uses MutationObserver to detect route changes
- Cleans up and re-initializes on navigation
- Demonstrates proper observer lifecycle

**`examples/api-fetcher.js`** — A cross-origin data fetcher that:
- Calls an external API via GM_xmlhttpRequest
- Uses @connect for the target domain
- Displays results in a floating panel
- Handles errors gracefully

**`examples/full-featured.js`** — A comprehensive example showing:
- Menu commands for configuration
- Persistent storage for settings
- CSS injection
- DOM manipulation
- Notification on completion

### Step 11: Write `scripts/validate-metadata.sh`

A bash script that:
- Checks for `==UserScript==` block presence
- Validates required fields (@name, @match or @include)
- Warns on `@grant none` combined with GM_* usage
- Warns on @match without scheme wildcard
- Checks @connect declarations vs GM_xmlhttpRequest usage
- Reports missing @version (needed for auto-update)

### Step 12: Review and validate

- Verify SKILL.md is under 2000 words
- Verify all reference files are referenced from SKILL.md
- Verify all referenced files exist
- Verify examples are syntactically valid
- Verify imperative voice throughout (no "you should")
- Test validate-metadata.sh against examples

---

## Resolved Decisions

1. **Description/trigger phrases**: User is writing these independently. SKILL.md frontmatter `description` field will be left as a placeholder for the user to fill in.

2. **Scope of manager-compatibility.md**: TM/VM/GM only. Safari (Userscripts app) is out of scope — different enough to warrant a separate skill later.

3. **@require library patterns**: Prefer native-API solutions where practical. Only @require libraries that are high-impact to the task. Include this guidance in SKILL.md workflow and in `references/metadata-block.md` under the @require section. No dedicated library reference file.

4. **UserStyles vs UserScripts**: Not covering Stylus-compatible userstyles. CSS-only userscripts (applying styles via `GM_addStyle`) are covered naturally by the CSS injection reference but don't need special callout or a dedicated section.

---

## Risks / Watch-Outs

1. **MV3 landscape is actively shifting.** Violentmonkey's MV3 status could change. The skill should note dates on compatibility claims and recommend checking current status.

2. **Reference file size creep.** The GM API is large. `gm-api.md` at 3000 words will need discipline to stay focused on what Claude needs (signatures + key notes) vs. what a human tutorial would include (extended explanations).

3. **Example scripts can go stale.** External APIs used in `api-fetcher.js` example should use a stable, public API (like JSONPlaceholder or a similar test endpoint).

4. **Cross-manager testing.** The skill will recommend patterns that work across managers, but we can't verify every claim in every manager version. Notes should specify which manager version introduced specific features.

5. **Security guidance needs balance.** Too much security content in SKILL.md will bloat it; too little means Claude might generate unsafe scripts. The current design puts a quick checklist in SKILL.md and detailed guidance in `references/security.md` — this needs to be reviewed to ensure the checklist catches the most critical issues.
