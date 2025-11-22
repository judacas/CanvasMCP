# Canvas GraphQL Query Forwarder Extension

This extension allows a backend service to execute GraphQL queries against Canvas LMS by forwarding them through the browser extension, which has access to the necessary cookies and CSRF tokens.

## How It Works

1. **Backend** sends a GraphQL query to the extension
2. **Extension** finds an active Canvas tab
3. **Content Script** executes the query using the browser's cookies and CSRF tokens
4. **Results** are forwarded back to the backend

## Installation

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select the `extensions/queryForwarder` directory

## Usage from Backend

### Method 1: Chrome Extension Messaging API

If your backend is a Chrome extension or can communicate via Chrome's messaging API:

```javascript
// From a Chrome extension or service that can use chrome.runtime
chrome.runtime.sendMessage('EXTENSION_ID', {
    action: 'executeGraphQLQuery',
    query: `
        query {
            course(id: "123") {
                name
                id
            }
        }
    `,
    variables: {},
    endpoint: 'https://usflearn.instructure.com/api/graphql' // optional
}, (response) => {
    if (response.success) {
        console.log('Query result:', response.data);
    } else {
        console.error('Query failed:', response.error);
    }
});
```

### Method 2: Native Messaging (for external applications)

For external applications, you can use Chrome's Native Messaging protocol. The extension listens for external messages from `localhost` and `127.0.0.1`.

### Method 3: Local HTTP Server (Recommended)

Create a simple HTTP server that the extension can communicate with:

```javascript
// Example Node.js server
const express = require('express');
const app = express();

app.use(express.json());

app.post('/execute-query', async (req, res) => {
    const { query, variables, endpoint } = req.body;
    
    // Send message to extension
    // Note: This requires a bridge service that can communicate with Chrome extensions
    // You may need to use chrome-remote-interface or similar
    
    res.json({ message: 'Query forwarded to extension' });
});

app.listen(3000, () => {
    console.log('Server running on http://localhost:3000');
});
```

## Requirements

- An active Canvas tab must be open in the browser
- The user must be logged into Canvas in that tab
- The extension needs permission to access Canvas domains

## API

### Request Format

```json
{
    "action": "executeGraphQLQuery",
    "query": "query { ... }",
    "variables": {},
    "endpoint": "https://usflearn.instructure.com/api/graphql"
}
```

### Response Format (Success)

```json
{
    "success": true,
    "data": {
        "data": { ... },
        "errors": [ ... ]
    }
}
```

### Response Format (Error)

```json
{
    "success": false,
    "error": {
        "message": "Error message",
        "status": 403,
        "statusText": "Forbidden",
        "data": { ... }
    }
}
```

## Error Handling

Common errors:
- **"No active Canvas tab found"**: Open a Canvas page in your browser
- **"Canvas GraphQL shared module not loaded"**: Refresh the Canvas page
- **403/422 errors**: CSRF token may be invalid or expired - refresh the Canvas page

## Architecture

- **background.js**: Service worker that receives queries and coordinates with content scripts
- **content_script.js**: Runs on Canvas pages, executes queries using shared module
- **shared/canvas-graphql.js**: Shared module with CSRF token finding and GraphQL execution logic

