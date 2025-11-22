# Native Host Setup for Query Forwarder Extension

This directory contains the native host implementation that allows the Chrome extension to communicate with external Python scripts via stdin/stdout (Native Messaging) and a local socket server.

## Architecture

1. **Extension** connects to **Native Host** via Chrome's Native Messaging protocol (stdin/stdout)
2. **Native Host** runs a socket server on port 8766
3. **External Python scripts** connect to the socket server to send queries
4. **Native Host** forwards queries to the extension
5. **Extension** executes queries and sends results back
6. **Native Host** forwards results to Python scripts via socket

## Installation

### Windows

1. **Install the native host manifest:**
   ```bash
   cd native_host
   install_native_host.bat
   ```

2. **Get your extension ID:**
   - Load the extension in Chrome
   - Go to `chrome://extensions/`
   - Find the extension and copy its ID

3. **Update the manifest:**
   - Edit `com.canvasmcp.queryforwarder.json` in:
     `%LOCALAPPDATA%\Google\Chrome\User Data\NativeMessagingHosts\`
   - Replace `YOUR_EXTENSION_ID_HERE` with your actual extension ID
   - Update the `path` to point to your Python executable
   - Update the `args` to point to `query_forwarder_host.py`

   Example:
   ```json
   {
     "name": "com.canvasmcp.queryforwarder",
     "description": "Native host for Canvas GraphQL Query Forwarder",
     "path": "C:\\Python\\python.exe",
     "args": ["C:\\path\\to\\query_forwarder_host.py"],
     "type": "stdio",
     "allowed_origins": [
       "chrome-extension://abcdefghijklmnopqrstuvwxyz123456/"
     ]
   }
   ```

4. **Load the extension in Chrome:**
   - Go to `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select the `extensions/queryForwarder` directory

5. **Open a Canvas page:**
   - Navigate to `https://usflearn.instructure.com` (or your Canvas instance)
   - Make sure you're logged in

## Usage

### Send a Query

```python
from native_host.send_query import send_query

result = send_query(
    query="query MyQuery { allCourses { name } }",
    variables={},
    endpoint="https://usflearn.instructure.com/api/graphql"
)

if result.get('success'):
    print(result['data'])
else:
    print('Error:', result['error'])
```

### Command Line

```bash
python native_host/send_query.py "query MyQuery { allCourses { name } }"
```

## How It Works

1. **Extension startup:** Extension automatically connects to native host
2. **Native host startup:** Chrome starts the Python script, which:
   - Connects to extension via stdin/stdout (Native Messaging)
   - Starts a socket server on port 8766
3. **Query flow:**
   - Python script connects to socket server
   - Sends query JSON
   - Native host forwards to extension
   - Extension executes query on Canvas page
   - Extension sends result to native host
   - Native host forwards result to Python script

## Troubleshooting

- **"Could not connect to native host"**
  - Make sure the native host manifest is installed correctly
  - Check that the extension ID in the manifest matches your extension
  - Verify the Python path is correct

- **"Extension not connected"**
  - Make sure the extension is loaded
  - Open a Canvas page
  - Check browser console for errors

- **"Socket connection refused"**
  - Make sure the extension is loaded (it starts the native host)
  - Check that port 8766 is not blocked

- **"No active Canvas tab found"**
  - Open a Canvas page in Chrome
  - Make sure you're logged in

## Files

- `query_forwarder_host.py` - Native host script (communicates with extension)
- `send_query.py` - Python API for sending queries
- `com.canvasmcp.queryforwarder.json` - Native host manifest template
- `install_native_host.bat` - Windows installation script

