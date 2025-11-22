# Debugging 422 Unprocessable Content Error

## ✅ SOLUTION FOUND

**The issue was resolved!** The CSRF token was URL-encoded and needed to be decoded before sending.

## Root Cause
- ✅ CSRF token was being found: `wsOtaQBx%2FJYTXbtcA%...`
- ❌ Request returned 422 Unprocessable Content
- ⚠️ Token was URL-encoded (`%2F` = `/`) but was being sent encoded
- ✅ **Fix**: Decode token with `decodeURIComponent()` before sending

## Working Solution

The token from `window.ENV.CSRF_TOKEN` is URL-encoded and must be decoded:

```javascript
let csrfToken = window.ENV.CSRF_TOKEN;
if (csrfToken && csrfToken.includes('%')) {
    csrfToken = decodeURIComponent(csrfToken);  // This fixed it!
}
```

See `CanvasMCPNotes/Canvas-GraphQL-CSRF-Token-Solution.md` for the complete working solution.

## Fixes Applied

### 1. CSRF Token Decoding
The code now automatically decodes URL-encoded CSRF tokens. The token `wsOtaQBx%2FJYTXbtcA%...` will be decoded to `wsOtaQBx/JYTXbtcA%...` before sending.

### 2. Enhanced Error Logging
The code now logs:
- Request URL
- Request headers (with token preview)
- Request body (the GraphQL query)
- Full error response

## How to Debug Further

### Step 1: Check the Console
After the error, check the console for:
- The exact request body being sent
- The full error response from Canvas
- Any warnings about token decoding

### Step 2: Use Browser DevTools Network Tab

1. **Open DevTools** (F12)
2. **Go to Network tab**
3. **Filter by "graphql"**
4. **Make your request** (or wait for Canvas to make one)
5. **Click on the request** to see:
   - **Request Headers** - Check the exact `X-CSRF-Token` value Canvas uses
   - **Request Payload** - See the exact body format Canvas uses
   - **Response** - See the full error message

### Step 3: Compare Your Request vs Canvas's Request

Look for differences in:
- **Headers**: Are you missing any headers Canvas sends?
- **Body format**: Is your JSON structure the same?
- **CSRF Token format**: Is it encoded/decoded the same way?

### Step 4: Try a Simpler Query

The introspection query is very large. Try a simpler query first:

```javascript
// In browser console on Canvas page
const simpleQuery = `query { allCourses { name } }`;

fetch('https://usflearn.instructure.com/api/graphql', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-CSRF-Token': window.ENV.CSRF_TOKEN, // or however you get it
    'Accept': 'application/json+canvas-string-ids, application/json, text/plain, */*',
    'X-Requested-With': 'XMLHttpRequest'
  },
  credentials: 'include',
  body: JSON.stringify({ query: simpleQuery })
})
.then(r => r.json())
.then(console.log)
.catch(console.error);
```

## Common Causes of 422 Errors

### 1. Invalid GraphQL Query Syntax
- Check for syntax errors in your query
- Try a minimal query first: `query { __typename }`

### 2. CSRF Token Issues
- Token might be expired (refresh the page)
- Token might need to be decoded (now handled automatically)
- Token format might be wrong

### 3. Missing Required Headers
Canvas might require additional headers. Check what Canvas sends in the Network tab.

### 4. Request Body Format
Canvas might expect:
- `{ query: "..." }` ✅ (what we're sending)
- `{ query: "...", variables: {} }` (if variables are required)
- Different JSON structure

### 5. Query Too Large
The introspection query is very large. Canvas might have limits. Try a smaller query first.

## Next Steps

1. **Refresh the page** to get a fresh CSRF token
2. **Check the console** for the detailed error logs
3. **Use Network tab** to see Canvas's actual requests
4. **Try a simpler query** first to verify the setup works
5. **Compare headers** between your request and Canvas's request

## Using the Interceptor

To see exactly how Canvas makes GraphQL requests, you can inject the interceptor script:

```javascript
// In browser console, paste the content of intercept-canvas-graphql.js
// Or use the extension's "Intercept GraphQL" feature (if added)
```

This will log all Canvas GraphQL requests to the console so you can see the exact format.

