# How to Find CSRF Token in Canvas LMS - Developer Tools Guide

This guide explains how to use browser Developer Tools to find the CSRF token that Canvas LMS uses for GraphQL API requests.

## Method 1: Using Network Tab (Recommended)

This is the most reliable way to see exactly what Canvas sends:

1. **Open Canvas LMS** in your browser (e.g., `https://usflearn.instructure.com`)
2. **Open Developer Tools** (F12 or Right-click → Inspect)
3. **Go to the Network tab**
4. **Filter by "graphql"** in the search box
5. **Trigger a GraphQL request** (if Canvas makes any automatically) OR:
   - Navigate to a page that uses GraphQL
   - Or use the browser console to make a test request
6. **Click on the GraphQL request** in the Network tab
7. **Check the Request Headers** section
8. **Look for `X-CSRF-Token`** header - this is what Canvas sends!

### Example:
```
Request Headers:
  X-CSRF-Token: abc123def456...
  Content-Type: application/json
  Accept: application/json+canvas-string-ids, application/json, text/plain, */*
  X-Requested-With: XMLHttpRequest
```

## Method 2: Using Console to Inspect Page

1. **Open Canvas LMS** in your browser
2. **Open Developer Tools** (F12)
3. **Go to the Console tab**
4. **Run these commands one by one**:

```javascript
// Check meta tags
document.querySelector('meta[name="csrf-token"]')?.content
document.querySelector('meta[name="csrf_token"]')?.content

// Check window.ENV (Canvas often uses this)
window.ENV?.CSRF_TOKEN
window.ENV?.csrf_token

// Check jQuery ajaxSetup (if Canvas uses jQuery)
window.$?.ajaxSettings?.headers?.['X-CSRF-Token']

// Check all meta tags
Array.from(document.querySelectorAll('meta')).map(m => ({
  name: m.getAttribute('name'),
  content: m.getAttribute('content')?.substring(0, 30)
}))

// Check window.ENV keys
Object.keys(window.ENV || {})
```

## Method 3: Inspect Page Source

1. **Open Canvas LMS** in your browser
2. **Right-click → View Page Source** (or Ctrl+U)
3. **Search for "csrf"** (Ctrl+F)
4. **Look for patterns like**:
   - `<meta name="csrf-token" content="...">`
   - `CSRF_TOKEN: "..."` in JavaScript
   - `csrf_token: "..."` in JavaScript

## Method 4: Monitor JavaScript Execution

1. **Open Developer Tools** (F12)
2. **Go to Sources tab**
3. **Set a breakpoint** on `fetch` or `XMLHttpRequest`
4. **Trigger a GraphQL request**
5. **Inspect the headers** being sent

## How the Code Finds It

The enhanced `findCSRFToken()` function in `background.js` checks these sources in order:

1. ❌ **Meta tag**: `meta[name="csrf-token"]` - Not used by Canvas
2. ❌ **Meta tag (alt)**: `meta[name="csrf_token"]` - Not used by Canvas
3. ✅ **window.ENV.CSRF_TOKEN**: **THIS IS THE WORKING METHOD!** ⭐
4. ✅ **window.ENV.csrf_token**: Lowercase variant (fallback)
5. ✅ **jQuery ajaxSetup**: If Canvas uses jQuery's global settings
6. ❌ **Cookies**: `_csrf_token`, `csrf_token`, `csrf-token` - Not used by Canvas
7. ❌ **Data attributes**: On `<body>` or `<html>` elements - Not used by Canvas
8. ✅ **Global functions**: `getCSRFToken()` if Canvas exposes it
9. ✅ **Script tag parsing**: Searches inline scripts for CSRF patterns

## ⚠️ CRITICAL: URL Decoding Required

**IMPORTANT**: The CSRF token from `window.ENV.CSRF_TOKEN` is **URL-encoded** and **MUST be decoded** before sending!

```javascript
let token = window.ENV.CSRF_TOKEN;

// CRITICAL STEP: Decode the token
if (token && token.includes('%')) {
    token = decodeURIComponent(token);
}

// Now use the decoded token in headers
headers['X-CSRF-Token'] = token;
```

**Without decoding, you'll get a 422 Unprocessable Content error!**

## Common Canvas CSRF Token Locations

Based on Canvas LMS implementation patterns:

### ✅ WORKING METHOD: `window.ENV.CSRF_TOKEN` ⭐
**This is the method that works!** Canvas stores the CSRF token in a global `ENV` object:
```javascript
window.ENV = {
  CSRF_TOKEN: "wsOtaQBx%2FJYTXbtcA%...",  // Note: URL-encoded!
  // other config...
}

// Must decode before using:
let token = decodeURIComponent(window.ENV.CSRF_TOKEN);
```

### ❌ Not Used by Canvas
- Meta tags (`<meta name="csrf-token">`) - Not present on Canvas pages
- Cookies - CSRF token not stored in cookies
- Data attributes - Not used by Canvas

### Alternative (if available)
If Canvas uses jQuery, it may set it globally:
```javascript
$.ajaxSetup({
  headers: {
    'X-CSRF-Token': 'abc123...'
  }
});
```

## Testing Your Findings

Once you find the CSRF token, test it:

```javascript
// In browser console on Canvas page
let token = window.ENV.CSRF_TOKEN; // Get token from ENV object

// CRITICAL: Decode URL-encoded token
if (token && token.includes('%')) {
    token = decodeURIComponent(token);
}

fetch('https://usflearn.instructure.com/api/graphql', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-CSRF-Token': token,  // Use decoded token
    'Accept': 'application/json+canvas-string-ids, application/json, text/plain, */*',
    'X-Requested-With': 'XMLHttpRequest',
    'Origin': window.location.origin,
    'Referer': window.location.href
  },
  credentials: 'include',
  body: JSON.stringify({
    query: '{ allCourses { name } }'
  })
})
.then(r => r.json())
.then(console.log)
.catch(console.error);
```

## Using the Extension's Diagnostic Tool

The extension now includes a **"Diagnose CSRF Token"** button that will:
1. Check all common locations
2. Report where it found (or didn't find) the token
3. Show you what methods were checked

This is the easiest way to find the token without manually using DevTools!

## Troubleshooting

### "CSRF token not found"
- Make sure you're on a Canvas page (not GraphiQL)
- Make sure you're logged in
- Try refreshing the page
- Check browser console for errors
- Use the diagnostic tool in the extension

### "403 Forbidden" error
- CSRF token is missing or incorrect
- Token may have expired (refresh the page)
- Check that you're sending `X-CSRF-Token` header (not `X-Csrf-Token` or other variants)

### "422 Unprocessable Content" error
- **Most common cause**: Token is URL-encoded but not decoded
- **Solution**: Use `decodeURIComponent()` on the token before sending
- Check if token contains `%` characters (indicates URL encoding)
- Verify token is from `window.ENV.CSRF_TOKEN` (the working method)

### "CORS error"
- Make sure you're making the request from the same origin
- Use `credentials: 'include'` in fetch options
- The extension injects into the page context to avoid CORS issues

## Next Steps

1. **Run the diagnostic tool** in the extension popup
2. **Check the results** to see which method found the token
3. **If not found**, use Method 1 (Network tab) to see what Canvas actually sends
4. **Update the code** if you find a new location not covered by the finder

