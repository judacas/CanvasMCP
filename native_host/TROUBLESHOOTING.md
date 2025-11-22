# Troubleshooting Native Messaging

## Error: "chrome.runtime.connectNative is not a function"

This means Chrome can't find the native host. Follow these steps:

### Step 1: Verify Native Host is Installed

1. Check if the manifest file exists:
   - Windows: `%LOCALAPPDATA%\Google\Chrome\User Data\NativeMessagingHosts\com.canvasmcp.queryforwarder.json`
   - Or: `C:\Users\YOUR_USERNAME\AppData\Local\Google\Chrome\User Data\NativeMessagingHosts\com.canvasmcp.queryforwarder.json`

2. Open the file and verify it looks like this:
   ```json
   {
     "name": "com.canvasmcp.queryforwarder",
     "description": "Native host for Canvas GraphQL Query Forwarder",
     "path": "C:\\Python\\python.exe",
     "args": ["C:\\full\\path\\to\\query_forwarder_host.py"],
     "type": "stdio",
     "allowed_origins": [
       "chrome-extension://YOUR_EXTENSION_ID_HERE/"
     ]
   }
   ```

3. **Important checks:**
   - `path` must be the FULL path to Python (not just "python")
   - `args` must be the FULL path to `query_forwarder_host.py`
   - `allowed_origins` must have your actual Extension ID (with `chrome-extension://` prefix and `/` suffix)

### Step 2: Get Your Extension ID

1. Go to `chrome://extensions/`
2. Find "Canvas GraphQL Query Forwarder"
3. Copy the ID (long string like `abcdefghijklmnopqrstuvwxyz123456`)
4. The full origin should be: `chrome-extension://abcdefghijklmnopqrstuvwxyz123456/`

### Step 3: Update the Manifest File

1. Open the manifest file (from Step 1)
2. Replace `YOUR_EXTENSION_ID_HERE` with your actual Extension ID
3. Make sure paths are absolute (full paths, not relative)
4. Save the file

### Step 4: Reload the Extension

1. Go to `chrome://extensions/`
2. Find "Canvas GraphQL Query Forwarder"
3. Click the reload icon (circular arrow)
4. Check the console for errors (click "service worker" or "background page" to see logs)

### Step 5: Test the Connection

1. Open browser console (F12)
2. Go to the "Console" tab
3. Look for messages like "Connected to native host" or errors

## Error: "Failed to connect to native host"

This means the native host script can't be started. Check:

1. **Python path is correct** - The `path` in the manifest must point to a real Python executable
2. **Script path is correct** - The `args` path must point to the actual `query_forwarder_host.py` file
3. **Python can run** - Try running `python --version` in command prompt
4. **Script is executable** - Try running the script directly: `python query_forwarder_host.py`

## Still Not Working?

1. **Check Chrome version** - Native messaging requires Chrome 26+
2. **Check for typos** - Extension ID, paths, etc. must be exact
3. **Restart Chrome** - Sometimes Chrome needs a full restart
4. **Check permissions** - Make sure Chrome has permission to run Python scripts

## Quick Test

To test if native messaging works at all:

1. Create a simple test native host
2. Try connecting from the extension
3. Check browser console for errors

## Common Mistakes

- ❌ Using relative paths instead of absolute paths
- ❌ Forgetting the `/` at the end of the extension ID in `allowed_origins`
- ❌ Not reloading the extension after installing native host
- ❌ Wrong Extension ID
- ❌ Python path doesn't exist or is wrong

