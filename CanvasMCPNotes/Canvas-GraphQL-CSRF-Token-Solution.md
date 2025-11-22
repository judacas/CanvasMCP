# Canvas LMS GraphQL CSRF Token - Working Solution

## ✅ Solution Summary

**The working method to get the CSRF token for Canvas LMS GraphQL API requests:**

1. **Source**: `window.ENV.CSRF_TOKEN` - Canvas stores the CSRF token in a global `ENV` object
2. **Critical Step**: The token is **URL-encoded** and must be **decoded** before sending
3. **Decoding**: Use `decodeURIComponent()` to decode the token

## Working Code

```javascript
function findCSRFToken() {
    // Method 4: window.ENV.CSRF_TOKEN (THIS IS THE ONE THAT WORKS!)
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

## Complete Working Example

```javascript
async function makeGraphQLRequest(query) {
    const graphqlEndpoint = 'https://usflearn.instructure.com/api/graphql';
    
    // 1. Get CSRF token from window.ENV
    let csrfToken = null;
    if (window.ENV && window.ENV.CSRF_TOKEN) {
        csrfToken = window.ENV.CSRF_TOKEN;
        
        // 2. Decode if URL-encoded (REQUIRED!)
        if (csrfToken.includes('%')) {
            csrfToken = decodeURIComponent(csrfToken);
        }
    }
    
    if (!csrfToken) {
        throw new Error('CSRF token not found');
    }
    
    // 3. Make the request with proper headers
    const response = await fetch(graphqlEndpoint, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json+canvas-string-ids, application/json, text/plain, */*',
            'X-Requested-With': 'XMLHttpRequest',
            'Origin': window.location.origin,
            'Referer': window.location.href,
            'X-CSRF-Token': csrfToken  // Use decoded token
        },
        credentials: 'include',  // Important for cookies
        body: JSON.stringify({ query })
    });
    
    if (!response.ok) {
        throw new Error(`Request failed: ${response.status} ${response.statusText}`);
    }
    
    return await response.json();
}

// Usage
const query = `query { allCourses { name } }`;
makeGraphQLRequest(query)
    .then(data => console.log('Success:', data))
    .catch(error => console.error('Error:', error));
```

## Why This Works

### 1. Token Location: `window.ENV.CSRF_TOKEN`
- Canvas LMS exposes the CSRF token in a global `ENV` object
- This is the most reliable source for the token
- Available on all Canvas pages after the page loads

### 2. URL Encoding Issue
- Canvas stores the token as URL-encoded (e.g., `wsOtaQBx%2FJYTXbtcA%...`)
- The `%2F` represents a `/` character
- **Sending the encoded token causes a 422 Unprocessable Content error**
- **Decoding with `decodeURIComponent()` fixes the issue**

### 3. Required Headers
Canvas expects these headers:
- `Content-Type: application/json`
- `Accept: application/json+canvas-string-ids, application/json, text/plain, */*`
- `X-Requested-With: XMLHttpRequest`
- `X-CSRF-Token: <decoded-token>`
- `Origin: <canvas-domain>`
- `Referer: <current-page-url>`

## Console Log Evidence

From the working console output:

```
content_script.js:57 Found and decoded CSRF token via: unknown method
content_script.js:97 CSRF Token found: J7FCepEtIUy74y4S9wKQFuBbPH6Ih3...
content_script.js:266 GraphQL Response: {data: {…}}
```

The token was successfully:
1. ✅ Found from `window.ENV.CSRF_TOKEN`
2. ✅ Decoded from URL-encoded format
3. ✅ Used in the request header
4. ✅ Request succeeded (got GraphQL response with data)

## Alternative Methods (That Didn't Work)

The following methods were tried but are not reliable for Canvas:

1. ❌ `meta[name="csrf-token"]` - Not present on Canvas pages
2. ❌ `meta[name="csrf_token"]` - Not present on Canvas pages
3. ❌ `[data-csrf-token]` attribute - Not used by Canvas
4. ✅ `window.ENV.CSRF_TOKEN` - **THIS WORKS!**
5. ❌ Cookies - CSRF token not stored in cookies

## Implementation Notes

### For Chrome Extensions
- Must inject script into `MAIN` world (not isolated world) to access `window.ENV`
- Use `chrome.scripting.executeScript` with `world: 'MAIN'`
- Content scripts run in isolated world and cannot access `window.ENV`

### For Content Scripts
- Content scripts have limited access to page context
- May need to use `window.postMessage` to communicate with injected script
- Or inject script tag directly into page

### Token Expiration
- CSRF tokens may expire after some time
- Refresh the page to get a new token if requests start failing
- Token is tied to the session

## Troubleshooting

### Issue: Token not found
- **Solution**: Ensure you're on a Canvas page and `window.ENV` is loaded
- Wait for page to fully load before accessing `window.ENV.CSRF_TOKEN`

### Issue: 422 Unprocessable Content error
- **Solution**: Make sure you're decoding the token with `decodeURIComponent()`
- Check if token contains `%` characters (indicates URL encoding)

### Issue: 403 Forbidden error
- **Solution**: Token may be expired, refresh the page
- Verify token is being sent in `X-CSRF-Token` header (not `X-Csrf-Token`)

### Issue: CORS errors
- **Solution**: Make requests from the same origin (Canvas domain)
- Use `credentials: 'include'` in fetch options
- For extensions, inject into page context to avoid CORS

## References

- Working implementation: `simpleQueryExtensionTest/content_script.js`
- Console logs: `workingCookieGrabbingConsoleOutput.log`
- Tested on: `https://usflearn.instructure.com`

