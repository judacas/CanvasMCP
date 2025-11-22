# Testing the Query Forwarder Extension

## Quick Start

### Method 1: HTTP API (Recommended)

1. **Start Chrome with remote debugging:**
   ```bash
   chrome.exe --remote-debugging-port=9222
   ```
   (On Mac/Linux: `google-chrome --remote-debugging-port=9222`)

2. **Open a Canvas page:**
   - Navigate to `https://usflearn.instructure.com` (or your Canvas instance)
   - Make sure you're logged in

3. **Load the extension:**
   - Go to `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select the `extensions/queryForwarder` directory

4. **Install Python dependencies:**
   ```bash
   pip install websocket-client requests
   ```

5. **Start the test server:**
   ```bash
   python test_server.py
   ```

6. **Run the example:**
   ```bash
   python example_usage.py
   ```

### Method 2: Browser-based Test

1. **Open a Canvas page** in Chrome with the extension loaded

2. **Run the test client:**
   ```bash
   python test_client.py
   ```
   
   This will open a browser page that communicates with the extension.

## API Usage

### HTTP Endpoint

**POST** `http://localhost:8765/execute-query`

**Request Body:**
```json
{
  "query": "query MyQuery { allCourses { name } }",
  "variables": {},
  "endpoint": "https://usflearn.instructure.com/api/graphql"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "data": { ... },
    "errors": [ ... ]
  }
}
```

### Python Example

```python
import requests

response = requests.post('http://localhost:8765/execute-query', json={
    'query': 'query MyQuery { allCourses { name } }',
    'variables': {},
    'endpoint': 'https://usflearn.instructure.com/api/graphql'
})

result = response.json()
if result['success']:
    print(result['data'])
else:
    print('Error:', result['error'])
```

## Troubleshooting

- **"Could not connect to Chrome DevTools Protocol"**
  - Make sure Chrome is started with `--remote-debugging-port=9222`
  - Check that port 9222 is not blocked by firewall

- **"No Canvas tab found"**
  - Open a Canvas page in Chrome
  - Make sure the URL contains "instructure.com" or "canvas"

- **"Timeout waiting for extension response"**
  - Make sure the extension is loaded
  - Refresh the Canvas page to reload the content script
  - Check browser console for errors

- **"Canvas GraphQL shared module not loaded"**
  - Refresh the Canvas page
  - Check that `canvas-graphql.js` is in the extension directory

