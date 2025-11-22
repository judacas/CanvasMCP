#!/usr/bin/env python3
"""
Python API for sending queries to the Canvas GraphQL Query Forwarder extension
via Native Messaging.

This script communicates with the native host, which in turn communicates
with the Chrome extension.
"""

import json
import struct
import sys
import os
import subprocess
import platform

def get_native_host_path():
    """Get the path to the native host script"""
    script_dir = os.path.dirname(os.path.abspath(__file__))
    return os.path.join(script_dir, 'query_forwarder_host.py')

def send_query_via_native_host(query, variables=None, endpoint=None):
    """
    Send a query to the extension via the native host.
    
    Note: This is a simplified version. In practice, Chrome manages the
    connection to the native host. This function demonstrates how to
    communicate, but you'll need to use Chrome's Native Messaging API
    from within the extension context.
    """
    print("=" * 70)
    print("Canvas GraphQL Query Forwarder - Native Host API")
    print("=" * 70)
    print("\nNOTE: Native Messaging requires Chrome to manage the connection.")
    print("The extension background script automatically connects to the native host.")
    print("\nTo use this:")
    print("1. Make sure native host is installed (run install_native_host.bat)")
    print("2. Load the extension in Chrome")
    print("3. Open a Canvas page")
    print("4. The extension will execute queries automatically")
    print("\nFor programmatic access, you can:")
    print("- Use Chrome's extension messaging API from another extension")
    print("- Or use the HTTP server approach (test_server.py)")
    print("\n" + "=" * 70)
    
    # The actual implementation would require Chrome to be running
    # and the extension to be loaded. The native host script runs
    # as a separate process managed by Chrome.

if __name__ == '__main__':
    import sys
    
    if len(sys.argv) < 2:
        print("Usage: python query_api.py '<graphql_query>' [variables_json] [endpoint]")
        sys.exit(1)
    
    query = sys.argv[1]
    variables = json.loads(sys.argv[2]) if len(sys.argv) > 2 else {}
    endpoint = sys.argv[3] if len(sys.argv) > 3 else None
    
    send_query_via_native_host(query, variables, endpoint)

