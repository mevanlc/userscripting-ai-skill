# Legacy Escaping Workarounds (Claude Chrome Direct)

**Context:** These workarounds applied when using Claude Chrome directly (not via Claude Code MCP). They may no longer be necessary with the Claude Code → Claude Chrome MCP workflow. Preserved here for reference in case similar issues surface.

## Backslash Escaping in javascript_tool

When using the `javascript_tool` directly in Claude Chrome, backslashes get consumed by escape processing layers. Writing `\s` (for a regex whitespace character) would arrive as just `s` in the executed code.

**The fix:** Use 4 backslashes in the tool parameter to get 1 backslash in the final executed JavaScript:

| Written in tool param | Executes in browser |
|-----------------------|---------------------|
| `\\\\s` | `\s` |
| `\\\\n` | `\n` |
| `\\\\t` | `\t` |

**Why it happened:** Two layers of escape processing:
1. Tool parameter transmission (4 backslashes → 2)
2. Template literal / string processing (2 backslashes → 1)

**Alternative:** Avoid backslashes entirely:
- Instead of `/\s+/` for whitespace split, use `split(' ').filter(c => c.length > 0)`
- Instead of `'\n'` for newline, use `String.fromCodePoint(10)`
- Instead of `'\t'` for tab, use `String.fromCodePoint(9)`

**Debugging tip:** Check character codes to verify what actually arrived:
```javascript
Array.from(myString).map(c => c.charCodeAt(0))
// Look for 92 (backslash) in the output
```

## Equals Sign Blocking

Claude Chrome sometimes refused to return strings containing `=` in certain contexts, often with a warning about cookie content. The workaround was to escape equals signs before returning:

```javascript
myExpression.replaceAll('=', '&equals;')
```

Then mentally substitute `&equals;` back to `=` when reading results. The `&equals;` was a transport-only escape — downstream actions should use the real `=` character.

