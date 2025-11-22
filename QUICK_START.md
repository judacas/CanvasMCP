# Quick Start Guide

## Why Remote Debugging is Needed

The `test_server.py` uses **Chrome DevTools Protocol (CDP)** to communicate with your browser. Here's why:

1. **Authentication**: Canvas requires cookies and CSRF tokens that only exist in your browser session
2. **Extension Communication**: The server needs to inject JavaScript into the Canvas page to communicate with the extension
3. **WebSocket Connection**: CDP provides a WebSocket connection to execute scripts in the browser context

**Without remote debugging**, the Python server cannot:
- Access your browser's cookies
- Inject JavaScript into Canvas pages
- Communicate with the extension

## Starting Chrome with Remote Debugging (Windows)

### Option 1: Use the Helper Script (Easiest)

**PowerShell:**
```powershell
.\start_chrome_debug.ps1
```

**Command Prompt:**
```cmd
start_chrome_debug.bat
```

### Option 2: Manual Start

Find Chrome and start it manually:

**Chrome:**
```cmd
"C:\Program Files\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222 --remote-allow-origins=*
```

**Or if Chrome is in Program Files (x86):**
```cmd
"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222 --remote-allow-origins=*
```

**Microsoft Edge (also works):**
```cmd
"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" --remote-debugging-port=9222 --remote-allow-origins=*
```

**Important:** The `--remote-allow-origins=*` flag is required to allow WebSocket connections from the test server. Without it, you'll get a 403 Forbidden error.

### Finding Chrome on Windows

If you get "chrome.exe not found", try these locations:

1. **Check common locations:**
   - `C:\Program Files\Google\Chrome\Application\chrome.exe`
   - `C:\Program Files (x86)\Google\Chrome\Application\chrome.exe`

2. **Find via Windows Search:**
   - Press `Win + S`
   - Type "chrome"
   - Right-click Chrome → "Open file location"
   - Copy the full path

3. **Use PowerShell to find it:**
   ```powershell
   Get-ItemProperty "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\chrome.exe" | Select-Object -ExpandProperty "(default)"
   ```

## Complete Setup Steps

1. **Start Chrome with remote debugging:**
   ```powershell
   .\start_chrome_debug.ps1
   ```

2. **Open Canvas and log in:**
   - Navigate to `https://usflearn.instructure.com`
   - Log in to your account

3. **Load the extension:**
   - Go to `chrome://extensions/`
   - Enable "Developer mode" (top right)
   - Click "Load unpacked"
   - Select the `extensions/queryForwarder` directory

4. **Start the test server:**
   ```bash
   python test_server.py
   ```

5. **Run the example:**
   ```bash
   python example_usage.py
   ```

## Troubleshooting

### "Could not connect to Chrome DevTools Protocol on port 9222"
- Make sure Chrome is started with `--remote-debugging-port=9222 --remote-allow-origins=*`
- Check that no firewall is blocking port 9222
- Try closing all Chrome windows and restarting with the flags

### "Handshake status 403 Forbidden" or "Rejected an incoming WebSocket connection"
- This means Chrome is blocking WebSocket connections
- Make sure you included `--remote-allow-origins=*` when starting Chrome
- Close Chrome completely and restart with both flags: `--remote-debugging-port=9222 --remote-allow-origins=*`

### "No Canvas tab found"
- Open a Canvas page (usflearn.instructure.com) in Chrome
- Make sure you're logged in

### "Timeout waiting for extension response"
- Make sure the extension is loaded
- Refresh the Canvas page to reload the content script
- Check the browser console (F12) for errors

### Chrome.exe not found
- Use the helper scripts (`start_chrome_debug.ps1` or `start_chrome_debug.bat`)
- Or manually find Chrome and use the full path in quotes

## Understanding the Two Test Scripts

### test_server.py (Requires Remote Debugging)

**What it does:**
- Runs a **persistent HTTP API server** on port 8765
- Provides a REST API endpoint: `POST http://localhost:8765/execute-query`
- Uses **Chrome DevTools Protocol (CDP)** to inject JavaScript into your Canvas page
- Can be called from any HTTP client (Python, curl, Postman, etc.)

**How it works:**
1. You send an HTTP POST request to the server
2. Server connects to Chrome via CDP (port 9222)
3. Server finds your Canvas tab
4. Server injects JavaScript into that tab via WebSocket
5. Injected script sends `postMessage` to extension
6. Extension executes query and returns result
7. Server returns result as HTTP response

**Requires:** Remote debugging enabled (`--remote-debugging-port=9222`)

**Use when:** You want a production-like API that other programs can call

---

### test_client.py (No Remote Debugging Needed)

**What it does:**
- Opens a **test HTML page** in your browser
- That page contains JavaScript that communicates with the extension
- More of a "demo/test" tool

**How it works:**
1. Script starts a temporary HTTP server
2. Opens a browser page with embedded JavaScript
3. JavaScript uses `window.postMessage()` to talk to extension
4. Extension responds via `postMessage`
5. Page sends result back to Python script

**Requires:** 
- Canvas page must be open (the test page must be on a Canvas domain)
- Extension must be loaded
- **NO remote debugging needed**

**Use when:** You want a quick test without setting up remote debugging

**Limitation:** The test page must be opened on a Canvas page, or the extension won't respond (because the content script only runs on Canvas pages)

---

## What is Remote Debugging?

**Remote Debugging** (also called Chrome DevTools Protocol or CDP) is a way for external programs to control and inspect Chrome from outside the browser.

Think of it like this:
- **Normal Chrome**: Only you can control it via the UI
- **Chrome with Remote Debugging**: External programs can:
  - See all open tabs
  - Inject JavaScript into any tab
  - Inspect network requests
  - Control the browser programmatically

**Why it's needed for test_server.py:**
- The Python server needs to inject JavaScript into your Canvas page
- Without remote debugging, Chrome blocks external programs from doing this
- With `--remote-debugging-port=9222`, Chrome opens a special port (9222) that allows external connections

**Security Note:** Remote debugging should only be enabled on localhost. Never enable it on a public network!

---

## Which Should You Use?

**Use `test_server.py` if:**
- You want a persistent API server
- You want to call it from other programs (like `example_usage.py`)
- You're building a backend service
- You don't mind enabling remote debugging

**Use `test_client.py` if:**
- You just want a quick test
- You don't want to enable remote debugging
- You're okay with the limitation that it must run on a Canvas page

