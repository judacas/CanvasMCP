# Fix: "chrome.runtime.connectNative is not a function"

## The Problem

After installing the native host, Chrome doesn't recognize `chrome.runtime.connectNative` until it's restarted.

## The Solution

**You MUST restart Chrome completely after installing the native host.**

### Steps:

1. **Close ALL Chrome windows** (not just tabs - fully exit Chrome)
   - Check Task Manager to make sure chrome.exe is not running

2. **Restart Chrome**

3. **Reload the extension:**
   - Go to `chrome://extensions/`
   - Find "Canvas GraphQL Query Forwarder"
   - Click the reload button

4. **Check the console:**
   - Click "service worker" or "background page" link under the extension
   - Look for "Connected to native host" message
   - If you see errors, check what they say

## Why This Happens

Chrome reads the native host registry only when it starts up. If you install the native host while Chrome is running, it won't see it until you restart.

## Verification

After restarting Chrome, the extension should automatically connect. You should see in the console:
- "Checking native messaging availability..."
- "chrome.runtime.connectNative exists: true"
- "Connected to native host"

If you still see errors after restarting, check:
1. Native host manifest file exists and is correct
2. Extension ID matches in the manifest
3. Python paths are correct

## Quick Test

1. Restart Chrome
2. Reload extension
3. Open browser console (F12)
4. Look for connection messages

