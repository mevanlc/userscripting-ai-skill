# Cross-Origin Requests and Network

## Why GM_xmlhttpRequest Exists

Regular fetch/XMLHttpRequest are blocked by CORS for cross-origin requests. GM_xmlhttpRequest executes from the browser extension's background script where CORS does not apply, enabling cross-origin requests from userscripts.

## Requirements

- `@grant GM_xmlhttpRequest`
- `@connect targetdomain.com` for each domain (supports wildcards, `self`, `localhost`, `*`)
- Without @connect, requests may silently fail or prompt the user

## GET Request Pattern

```javascript
GM_xmlhttpRequest({
  method: 'GET',
  url: 'https://api.example.com/data',
  responseType: 'json',
  onload: function(response) {
    if (response.status >= 200 && response.status < 300) {
      const data = response.response;
      // Process data
    }
  },
  onerror: function(error) {
    console.error('Request failed:', error.statusText);
  }
});
```

## POST with JSON

```javascript
GM_xmlhttpRequest({
  method: 'POST',
  url: 'https://api.example.com/submit',
  headers: { 'Content-Type': 'application/json' },
  data: JSON.stringify({ key: 'value' }),
  responseType: 'json',
  onload: function(response) { /* handle */ },
  onerror: function(error) { /* handle */ }
});
```

## POST with FormData

For multipart/form-data (file uploads, etc.) — just pass FormData as `data`:

```javascript
const formData = new FormData();
formData.append('file', fileBlob);
formData.append('name', 'filename.txt');

GM_xmlhttpRequest({
  method: 'POST',
  url: 'https://api.example.com/upload',
  data: formData,
  onload: function(response) { /* handle */ }
});
```

## Handling Responses

- Always check `response.status` — GM_xmlhttpRequest doesn't reject on HTTP errors
- `response.finalUrl` gives the URL after any redirects
- `response.responseHeaders` is a string — parse with split if needed
- For binary data use `responseType: 'blob'` or `'arraybuffer'`

### Response Object Properties

```javascript
onload: function(response) {
  response.status        // HTTP status code (200, 404, etc.)
  response.statusText    // Status message ("OK", "Not Found")
  response.responseText  // Response as text string
  response.response      // Parsed response (when responseType is set)
  response.responseHeaders // Raw header string
  response.finalUrl      // Final URL after redirects
  response.readyState    // XMLHttpRequest ready state
}
```

### Parsing Response Headers

```javascript
onload: function(response) {
  const headers = response.responseHeaders.split('\n').reduce((acc, line) => {
    const parts = line.split(': ');
    if (parts.length === 2) {
      acc[parts[0].toLowerCase()] = parts[1];
    }
    return acc;
  }, {});

  const contentType = headers['content-type'];
}
```

## Aborting Requests

```javascript
const request = GM_xmlhttpRequest({
  method: 'GET',
  url: 'https://api.example.com/large-file',
  onload: function(response) { /* handle */ }
});

// Later, cancel the request:
request.abort();
```

## Progress Tracking

Use `onprogress` callback for large downloads:

```javascript
GM_xmlhttpRequest({
  method: 'GET',
  url: 'https://api.example.com/large-file',
  responseType: 'blob',
  onprogress: function(progress) {
    if (progress.lengthComputable) {
      const percent = (progress.loaded / progress.total * 100).toFixed(1);
      console.log(`Downloaded: ${percent}%`);
    }
  },
  onload: function(response) { /* handle completed download */ }
});
```

## Timeout Configuration

Set a timeout in milliseconds:

```javascript
GM_xmlhttpRequest({
  method: 'GET',
  url: 'https://api.example.com/data',
  timeout: 5000, // 5 seconds
  ontimeout: function() {
    console.error('Request timed out');
  },
  onload: function(response) { /* handle */ }
});
```

## GM_download

For saving files to disk:

```javascript
GM_download({
  url: 'https://example.com/file.pdf',
  name: 'document.pdf',
  saveAs: true, // Prompt user for save location
  onerror: function(err) {
    console.error('Download failed:', err.error);
  },
  onload: function() {
    console.log('Download complete');
  }
});
```

Requires `@grant GM_download`.

### Download from Data URL

```javascript
const canvas = document.querySelector('canvas');
const dataUrl = canvas.toDataURL('image/png');

GM_download({
  url: dataUrl,
  name: 'screenshot.png',
  saveAs: false // Auto-save to default downloads folder
});
```

## Authentication and Headers

Set custom headers for authentication:

```javascript
GM_xmlhttpRequest({
  method: 'GET',
  url: 'https://api.example.com/protected',
  headers: {
    'Authorization': 'Bearer ' + token,
    'X-Custom-Header': 'value'
  },
  onload: function(response) { /* handle */ }
});
```

### Cookie Handling

Cookies are sent automatically for same-origin requests. For cross-origin:

- Tampermonkey: Sends cookies by default if @connect is declared
- Violentmonkey: May require explicit cookie headers
- Set `anonymous: true` to prevent sending cookies:

```javascript
GM_xmlhttpRequest({
  method: 'GET',
  url: 'https://api.example.com/data',
  anonymous: true, // Don't send cookies
  onload: function(response) { /* handle */ }
});
```

## Manifest V3 Considerations

- MV3 in Chrome removed the blocking webRequest API
- Some "forbidden" headers (Cookie, Origin, Referer) may not be settable in Chrome MV3
- Tampermonkey has workarounds but behavior may vary
- Firefox is unaffected — still supports full header manipulation
- Test cross-origin scripts in Chrome AND Firefox when possible

### Known MV3 Limitations

- User-Agent header modification restricted
- Some request interception capabilities reduced
- Synchronous requests deprecated (use async callbacks)
- Cookie header manipulation may be blocked

## Security Notes

- Treat all response data as untrusted — never pass directly to eval() or innerHTML
- Use @connect with specific domains, not `*` (wildcard allows requests to any domain)
- Declare only the domains actually needed
- Validate response.status before processing data
- Use HTTPS URLs when possible to prevent MITM attacks

## Error Handling Best Practices

```javascript
GM_xmlhttpRequest({
  method: 'GET',
  url: 'https://api.example.com/data',
  responseType: 'json',
  timeout: 10000,
  onload: function(response) {
    if (response.status >= 200 && response.status < 300) {
      try {
        const data = response.response;
        // Process valid data
      } catch (e) {
        console.error('Data processing error:', e);
      }
    } else if (response.status === 404) {
      console.warn('Resource not found');
    } else if (response.status >= 500) {
      console.error('Server error:', response.status);
    } else {
      console.error('Request failed:', response.status, response.statusText);
    }
  },
  onerror: function(error) {
    console.error('Network error:', error.statusText);
  },
  ontimeout: function() {
    console.error('Request timed out');
  }
});
```

## Common @connect Patterns

```javascript
// Specific domain
// @connect api.example.com

// Subdomain wildcard
// @connect *.example.com

// Current page's domain
// @connect self

// Localhost (for development)
// @connect localhost

// Allow all domains (NOT RECOMMENDED)
// @connect *
```

## Fetch API Polyfill Pattern

Wrap GM_xmlhttpRequest to provide a fetch-like interface:

```javascript
function gmFetch(url, options = {}) {
  return new Promise((resolve, reject) => {
    GM_xmlhttpRequest({
      method: options.method || 'GET',
      url: url,
      headers: options.headers || {},
      data: options.body,
      responseType: 'blob',
      onload: response => {
        resolve({
          ok: response.status >= 200 && response.status < 300,
          status: response.status,
          statusText: response.statusText,
          text: () => Promise.resolve(response.responseText),
          json: () => Promise.resolve(JSON.parse(response.responseText)),
          blob: () => Promise.resolve(response.response)
        });
      },
      onerror: reject
    });
  });
}

// Usage
gmFetch('https://api.example.com/data')
  .then(r => r.json())
  .then(data => console.log(data));
```
