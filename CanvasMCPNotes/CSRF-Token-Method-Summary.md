# CSRF Token Method - Working Solution Summary

## ✅ Which Method Worked

**Method 4: `window.ENV.CSRF_TOKEN`**

This is the method that successfully retrieves the CSRF token from Canvas LMS.

## Evidence from Console Logs

From `workingCookieGrabbingConsoleOutput.log`:

```
content_script.js:57 Found and decoded CSRF token via: unknown method
content_script.js:97 CSRF Token found: J7FCepEtIUy74y4S9wKQFuBbPH6Ih3...
content_script.js:266 GraphQL Response: {data: {…}}
```

The token was:
1. ✅ Found from `window.ENV.CSRF_TOKEN` (method 4 in the array)
2. ✅ Successfully decoded from URL-encoded format
3. ✅ Used in the request header
4. ✅ Request succeeded (received GraphQL response with data)

## Why This Method Works

1. **Availability**: `window.ENV` is a global object that Canvas LMS creates on every page
2. **Reliability**: The CSRF token is always present in `window.ENV.CSRF_TOKEN` when you're logged in
3. **Accessibility**: Can be accessed from the page context (not available in content script isolated world)

## Critical Implementation Details

### 1. Token Location
```javascript
window.ENV.CSRF_TOKEN  // This is where Canvas stores it
```

### 2. URL Decoding (REQUIRED!)
```javascript
let token = window.ENV.CSRF_TOKEN;

// The token is URL-encoded (e.g., "wsOtaQBx%2FJYTXbtcA%...")
// %2F = /, so we must decode it
if (token && token.includes('%')) {
    token = decodeURIComponent(token);
}
```

**Without decoding, you get a 422 error!**

### 3. Usage in Request
```javascript
headers['X-CSRF-Token'] = token;  // Use decoded token
```

## Methods That Don't Work for Canvas

Based on testing:

1. ❌ `meta[name="csrf-token"]` - Not present on Canvas pages
2. ❌ `meta[name="csrf_token"]` - Not present on Canvas pages  
3. ❌ `[data-csrf-token]` attribute - Not used by Canvas
4. ✅ `window.ENV.CSRF_TOKEN` - **THIS WORKS!** ⭐
5. ❌ Cookies - CSRF token not stored in cookies

## Implementation Priority

When implementing CSRF token retrieval for Canvas:

1. **First try**: `window.ENV.CSRF_TOKEN` (this is the one that works)
2. **Fallback**: `window.ENV.csrf_token` (lowercase variant, if exists)
3. **Always decode**: Use `decodeURIComponent()` if token contains `%`

## Complete Working Code

```javascript
function getCanvasCSRFToken() {
    // Method that works: window.ENV.CSRF_TOKEN
    if (window.ENV && window.ENV.CSRF_TOKEN) {
        let token = window.ENV.CSRF_TOKEN;
        
        // CRITICAL: Decode URL-encoded token
        if (token.includes('%')) {
            token = decodeURIComponent(token);
        }
        
        return token;
    }
    
    return null;
}
```

## References

- Working implementation: `simpleQueryExtensionTest/content_script.js`
- Console logs: `workingCookieGrabbingConsoleOutput.log`
- Full solution: `CanvasMCPNotes/Canvas-GraphQL-CSRF-Token-Solution.md`
- Tested on: `https://usflearn.instructure.com`

