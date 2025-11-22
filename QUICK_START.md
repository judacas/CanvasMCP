# Quick Start Guide

## What You're Building

A system where:
- **Python script** sends GraphQL queries
- **Chrome extension** executes them on Canvas (using your browser cookies)
- **Results** come back to Python

## Setup (5 minutes)

### 1. Load the Extension

1. Open Chrome
2. Type `chrome://extensions/` in the address bar
3. Turn ON "Developer mode" (top right toggle)
4. Click "Load unpacked"
5. Select the `extensions/queryForwarder` folder
6. **Copy the Extension ID** - it's shown under the extension name

### 2. Install Native Host

1. Open terminal in this folder
2. Run:
   ```bash
   cd native_host
   install_native_host.bat
   ```
3. When prompted, paste your Extension ID

### 3. Test It

1. Open a Canvas page in Chrome (usflearn.instructure.com)
2. Make sure you're logged in
3. Run:
   ```bash
   python example_native_usage.py
   ```

## That's It!

The extension automatically connects when Chrome starts. No debugging mode, no HTTP servers - just stdin/stdout communication.

## Troubleshooting

**"Could not connect to native host"**
- Make sure you ran `install_native_host.bat`
- Check that the Extension ID in the manifest matches your extension

**"No active Canvas tab found"**
- Open a Canvas page in Chrome
- Make sure you're logged in

**Extension not connecting**
- Reload the extension in `chrome://extensions/`
- Check the browser console (F12) for errors

