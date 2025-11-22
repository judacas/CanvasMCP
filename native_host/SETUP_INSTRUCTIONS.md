# Simple Setup Instructions

## What is Native Messaging?

Native Messaging lets your Chrome extension talk to a Python script on your computer via stdin/stdout. That's it!

## Step-by-Step Setup

### Step 1: Load the Extension in Chrome

1. Open Chrome
2. Go to `chrome://extensions/` (type this in the address bar)
3. Turn ON "Developer mode" (toggle in top right)
4. Click "Load unpacked"
5. Navigate to and select the `extensions/queryForwarder` folder
6. **Copy the Extension ID** - you'll see it under the extension name (looks like `abcdefghijklmnopqrstuvwxyz123456`)

### Step 2: Install the Native Host

1. Open a terminal/command prompt
2. Go to the `native_host` folder:
   ```bash
   cd native_host
   ```
3. Run the install script:
   ```bash
   install_native_host.bat
   ```
4. When it asks, paste your Extension ID

### Step 3: Open a Canvas Page

1. Open Chrome
2. Go to `https://usflearn.instructure.com` (or your Canvas URL)
3. Make sure you're logged in

### Step 4: Test It!

```bash
python example_native_usage.py
```

That's it! The extension will automatically connect to the Python script when Chrome starts.

## What the Install Script Does

The install script:
1. Finds your Python installation
2. Creates a file that tells Chrome: "When the extension wants to talk, run this Python script"
3. Puts that file in Chrome's configuration folder

You only need to run it once!

