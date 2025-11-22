#!/usr/bin/env python3
"""
Verify that the native host is set up correctly.
"""

import os
import json
import sys

def check_native_host():
    """Check if native host manifest exists and is valid"""
    print("=" * 70)
    print("Native Host Setup Verification")
    print("=" * 70)
    print()
    
    # Find manifest file
    if sys.platform == 'win32':
        manifest_path = os.path.join(
            os.getenv('LOCALAPPDATA'),
            'Google', 'Chrome', 'User Data', 'NativeMessagingHosts',
            'com.canvasmcp.queryforwarder.json'
        )
    else:
        # Linux/Mac
        manifest_path = os.path.expanduser(
            '~/.config/google-chrome/NativeMessagingHosts/com.canvasmcp.queryforwarder.json'
        )
    
    print(f"Checking manifest file: {manifest_path}")
    
    if not os.path.exists(manifest_path):
        print("❌ Manifest file not found!")
        print()
        print("Run install_native_host.bat to install the native host.")
        return False
    
    print("✓ Manifest file exists")
    
    # Read and validate manifest
    try:
        with open(manifest_path, 'r') as f:
            manifest = json.load(f)
    except json.JSONDecodeError as e:
        print(f"❌ Manifest file is invalid JSON: {e}")
        return False
    except Exception as e:
        print(f"❌ Error reading manifest: {e}")
        return False
    
    print("✓ Manifest file is valid JSON")
    
    # Check required fields
    required_fields = ['name', 'path', 'args', 'type', 'allowed_origins']
    for field in required_fields:
        if field not in manifest:
            print(f"❌ Missing required field: {field}")
            return False
    
    print("✓ All required fields present")
    
    # Check paths
    python_path = manifest.get('path', '')
    script_path = manifest.get('args', [])
    
    if script_path:
        script_path = script_path[0] if isinstance(script_path, list) else script_path
    
    print(f"\nPython path: {python_path}")
    if not os.path.exists(python_path):
        print("❌ Python executable not found at specified path!")
        return False
    print("✓ Python executable exists")
    
    print(f"\nScript path: {script_path}")
    if not os.path.exists(script_path):
        print("❌ Native host script not found at specified path!")
        return False
    print("✓ Native host script exists")
    
    # Check extension ID
    allowed_origins = manifest.get('allowed_origins', [])
    print(f"\nAllowed origins: {allowed_origins}")
    
    if not allowed_origins:
        print("⚠️  No allowed origins specified")
        print("   The extension ID needs to be added to 'allowed_origins'")
    else:
        for origin in allowed_origins:
            if not origin.startswith('chrome-extension://'):
                print(f"⚠️  Origin format might be wrong: {origin}")
                print("   Should be: chrome-extension://EXTENSION_ID/")
            elif origin.endswith('/'):
                print(f"✓ Origin format looks correct: {origin}")
            else:
                print(f"⚠️  Origin should end with '/': {origin}")
    
    print()
    print("=" * 70)
    print("Summary")
    print("=" * 70)
    print()
    print("To get your Extension ID:")
    print("1. Go to chrome://extensions/")
    print("2. Find 'Canvas GraphQL Query Forwarder'")
    print("3. Copy the ID shown under the extension name")
    print("4. Update the manifest file with:")
    print(f"   'allowed_origins': ['chrome-extension://YOUR_EXTENSION_ID/']")
    print()
    print("After updating, reload the extension in chrome://extensions/")
    print()
    
    return True

if __name__ == '__main__':
    check_native_host()

