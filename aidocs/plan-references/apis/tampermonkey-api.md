# Tampermonkey API Reference (fetched from tampermonkey.net/documentation.php)

## Userscript Metadata Tags

### Core Metadata
- **@name**: Script title; supports i18n via `@name:locale`
- **@namespace**: Script namespace identifier
- **@version**: Version number; follows semantic comparison (e.g., `1.0` < `1.1`)
- **@description**: Brief summary; i18n supported
- **@author**: Creator attribution
- **@copyright**: Copyright statement

### Execution Control
- **@match**: URL pattern specification (`protocol://domain/path`)
- **@include**: Regex or wildcard-based URL matching
- **@exclude**: URLs to skip despite includes/matches
- **@run-at**: Injection timing (`document-start`, `document-body`, `document-end`, `document-idle`, `context-menu`)
- **@run-in**: Context specification (`normal-tabs`, `incognito-tabs`, `container-id-X`)
- **@noframes**: Run on main page only, skip iframes

### Resources & Dependencies
- **@require**: Load external JavaScript before execution
- **@resource**: Preload resources accessible via `GM_getResourceURL`/`GM_getResourceText`
- **@icon**/**@icon64**: Script imagery

### Permissions & Connectivity
- **@grant**: Whitelist `GM_*` functions, `unsafeWindow`, `window.close`, `window.focus`, `window.onurlchange`
- **@connect**: Approve domains for `GM_xmlhttpRequest`; supports `self`, `localhost`, IP addresses, wildcards
- **@sandbox**: Execution context (`raw`, `JavaScript`, `DOM`)

### Metadata & Distribution
- **@homepage**/**@website**/**@source**: Author's website
- **@updateURL**: Custom update endpoint
- **@downloadURL**: Custom download source
- **@supportURL**: Issue reporting URL
- **@tag**: Script categorization
- **@antifeature**: Disclose monetization (`ads`, `tracking`, `miner`)
- **@webRequest**: JSON rules for request manipulation before script loads
- **@unwrap**: Inject without sandbox wrapper

---

## GM Functions (Callback Style)

### Storage
- **`GM_setValue(key, value)`**: Store data persistently
- **`GM_getValue(key, defaultValue)`**: Retrieve stored value
- **`GM_deleteValue(key)`**: Remove storage entry
- **`GM_listValues()`**: List all stored keys
- **`GM_setValues(object)`**: Batch storage assignment (v5.3+)
- **`GM_getValues(keysArray|defaultObject)`**: Batch retrieval (v5.3+)
- **`GM_deleteValues(keysArray)`**: Batch deletion (v5.3+)
- **`GM_addValueChangeListener(key, callback)`**: Monitor storage changes; returns listener ID
- **`GM_removeValueChangeListener(listenerId)`**: Unregister listener

### UI & Notifications
- **`GM_notification(details|text, title, image, onclick)`**: Display system notification
- **`GM_registerMenuCommand(name, callback, options|accessKey)`**: Add context menu item; returns ID
- **`GM_unregisterMenuCommand(menuCmdId)`**: Remove menu command
- **`GM_setClipboard(data, info, callback)`**: Set clipboard content

### HTTP Requests
- **`GM_xmlhttpRequest(details)`**: Send HTTP request with CORS bypass
  - Methods: GET, HEAD, POST, PUT, DELETE
  - Response callbacks: `onload`, `onerror`, `ontimeout`, `onprogress`, `onabort`
  - Returns: `abort()` function

### Download Management
- **`GM_download(details|url, name)`**: Download file to disk

### Tab Management
- **`GM_getTab(callback)`**: Retrieve persistent tab object
- **`GM_saveTab(tab, callback)`**: Store tab-specific data
- **`GM_getTabs(callback)`**: Access all saved tab data
- **`GM_openInTab(url, options|loadInBackground)`**: Open new tab/window

### Resource Access
- **`GM_getResourceText(name)`**: Retrieve `@resource` content as string
- **`GM_getResourceURL(name)`**: Get `@resource` URL

### DOM Manipulation
- **`GM_addElement(tagName, attributes)`**: Inject HTML element with CSP bypass
- **`GM_addStyle(css)`**: Inject stylesheet; returns style element

### Utilities
- **`GM_log(message)`**: Log to console
- **`GM_info`**: Script metadata object

### Cookie Management
- **`GM_cookie.list(details, callback)`**: Query cookies
- **`GM_cookie.set(details, callback)`**: Create/update cookie
- **`GM_cookie.delete(details, callback)`**: Remove cookie

---

## GM Promise API (Async/Await)

All callback-style functions have promise equivalents prefixed with `GM.`:
- `GM.setValue()`, `GM.getValue()`, `GM.deleteValue()`, `GM.listValues()`
- `GM.notification()`, `GM.xmlHttpRequest()`, `GM.download()`
- `GM.getTab()`, `GM.saveTab()`, `GM.getTabs()`
- `GM.getResourceText()`, `GM.getResourceUrl()`

## Special Objects
- **unsafeWindow**: Direct access to page's `window` object
- **window.onurlchange**: Listen for URL changes in SPAs (requires `@grant window.onurlchange`)

## Security
- SRI: Validate `@require` and `@resource` via hash anchors (SHA-256, MD5)
