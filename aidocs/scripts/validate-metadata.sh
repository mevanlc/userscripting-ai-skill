#!/usr/bin/env bash
#
# validate-metadata.sh — Check a userscript for common metadata errors.
# Usage: bash validate-metadata.sh <script.js>
#

set -euo pipefail

if [[ $# -ne 1 ]]; then
  echo "Usage: $0 <script.js>"
  exit 1
fi

FILE="$1"

if [[ ! -f "$FILE" ]]; then
  echo "Error: File not found: $FILE"
  exit 1
fi

ERRORS=0
WARNINGS=0

error() {
  echo "  ERROR: $1"
  ERRORS=$((ERRORS + 1))
}

warn() {
  echo "  WARN:  $1"
  WARNINGS=$((WARNINGS + 1))
}

info() {
  echo "  INFO:  $1"
}

echo "Validating: $FILE"
echo "---"

# Check for metadata block
if ! grep -q '// ==UserScript==' "$FILE"; then
  error "Missing ==UserScript== opening tag"
  echo ""
  echo "Result: $ERRORS error(s), $WARNINGS warning(s)"
  exit 1
fi

if ! grep -q '// ==/UserScript==' "$FILE"; then
  error "Missing ==/UserScript== closing tag"
fi

# Extract metadata block
META=$(sed -n '/==UserScript==/,/==\/UserScript==/p' "$FILE")

# Check required fields
if ! echo "$META" | grep -q '@name'; then
  error "@name is missing (required)"
fi

if ! echo "$META" | grep -q '@match\|@include'; then
  error "No @match or @include found — script will not run on any page"
fi

if ! echo "$META" | grep -q '@version'; then
  warn "@version is missing — auto-update will not work"
fi

# Check @match patterns
while IFS= read -r line; do
  pattern=$(echo "$line" | sed 's/.*@match[[:space:]]*//')
  # Check for missing scheme
  if [[ ! "$pattern" =~ ^(\*|https?|http\*|file):// ]]; then
    error "@match pattern missing scheme: '$pattern' — use *:// prefix"
  fi
done < <(echo "$META" | grep '@match' || true)

# Check @grant consistency
HAS_GRANT_NONE=$(echo "$META" | grep -c '@grant[[:space:]]*none' || true)
HAS_OTHER_GRANTS=$(echo "$META" | grep '@grant' | grep -cv 'none' || true)

if [[ "$HAS_GRANT_NONE" -gt 0 ]] && [[ "$HAS_OTHER_GRANTS" -gt 0 ]]; then
  error "@grant none combined with other @grant declarations — none overrides all others"
fi

# Extract the script body (after metadata block)
BODY=$(sed -n '/==\/UserScript==/,$ p' "$FILE" | tail -n +2)

# Check for GM_* usage without corresponding @grant
GM_FUNCS=(
  GM_getValue GM_setValue GM_deleteValue GM_listValues
  GM_getValues GM_setValues GM_deleteValues
  GM_addValueChangeListener GM_removeValueChangeListener
  GM_addStyle GM_addElement
  GM_xmlhttpRequest GM_download
  GM_registerMenuCommand GM_unregisterMenuCommand
  GM_notification GM_openInTab GM_setClipboard
  GM_getResourceText GM_getResourceURL
  GM_getTab GM_saveTab GM_getTabs
  GM_log
)

for func in "${GM_FUNCS[@]}"; do
  if echo "$BODY" | grep -q "$func"; then
    if ! echo "$META" | grep -q "@grant[[:space:]]*$func"; then
      if [[ "$HAS_GRANT_NONE" -gt 0 ]]; then
        error "$func used in code but @grant none is set — function will be undefined"
      else
        warn "$func used in code but not declared in @grant"
      fi
    fi
  fi
done

# Check unsafeWindow usage
if echo "$BODY" | grep -q 'unsafeWindow'; then
  if ! echo "$META" | grep -q '@grant[[:space:]]*unsafeWindow'; then
    if [[ "$HAS_GRANT_NONE" -eq 0 ]]; then
      warn "unsafeWindow used but not declared in @grant"
    fi
  fi
fi

# Check @connect for GM_xmlhttpRequest
if echo "$BODY" | grep -q 'GM_xmlhttpRequest\|GM\.xmlHttpRequest'; then
  if ! echo "$META" | grep -q '@connect'; then
    warn "GM_xmlhttpRequest used but no @connect declared — requests may fail or prompt"
  fi
fi

# Check @require without version pinning
while IFS= read -r line; do
  url=$(echo "$line" | sed 's/.*@require[[:space:]]*//')
  if [[ "$url" =~ cdn\.jsdelivr\.net|cdnjs\.cloudflare\.com|unpkg\.com ]]; then
    if [[ ! "$url" =~ @[0-9] ]]; then
      warn "@require URL may not be version-pinned: $url"
    fi
    if [[ ! "$url" =~ \#(sha256|md5)= ]]; then
      warn "@require URL missing SRI hash: $url"
    fi
  fi
done < <(echo "$META" | grep '@require' || true)

# Check @resource without SRI
while IFS= read -r line; do
  url=$(echo "$line" | sed 's/.*@resource[[:space:]]*[^ ]* //')
  if [[ ! "$url" =~ \#(sha256|md5)= ]]; then
    info "@resource without SRI hash: $url"
  fi
done < <(echo "$META" | grep '@resource' || true)

# Check @include usage
if echo "$META" | grep -q '@include'; then
  info "@include found — consider using @match instead (stricter, safer)"
fi

# Check for @noframes
if ! echo "$META" | grep -q '@noframes'; then
  info "No @noframes — script will run in iframes too"
fi

# Check @run-at document-start with DOM operations
RUN_AT=$(echo "$META" | grep '@run-at' | sed 's/.*@run-at[[:space:]]*//' | head -1)
if [[ "$RUN_AT" == "document-start" ]]; then
  if echo "$BODY" | grep -q 'document\.body\|document\.head\|document\.querySelector\|document\.getElementById\|GM_addStyle\|GM_addElement'; then
    warn "@run-at document-start with DOM operations — DOM may not exist yet"
  fi
fi

echo "---"
echo "Result: $ERRORS error(s), $WARNINGS warning(s)"

if [[ $ERRORS -gt 0 ]]; then
  exit 1
fi
exit 0
