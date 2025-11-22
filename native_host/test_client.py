#!/usr/bin/env python3
"""
Test client for the native host.
Sends queries to the extension via the native host.
"""

import json
import struct
import sys
import os
import subprocess

def send_message(message):
    """Send a message to native host via stdout"""
    message_json = json.dumps(message)
    message_bytes = message_json.encode('utf-8')
    
    # Write message length (4 bytes, little-endian)
    sys.stdout.buffer.write(struct.pack('<I', len(message_bytes)))
    # Write message
    sys.stdout.buffer.write(message_bytes)
    sys.stdout.buffer.flush()

def read_message():
    """Read a message from native host via stdin"""
    # Read message length (first 4 bytes)
    length_bytes = sys.stdin.buffer.read(4)
    if len(length_bytes) == 0:
        return None
    
    # Unpack length (32-bit little-endian integer)
    message_length = struct.unpack('<I', length_bytes)[0]
    
    # Read the message
    message_bytes = sys.stdin.buffer.read(message_length)
    if len(message_bytes) < message_length:
        return None
    
    # Decode JSON
    message_json = message_bytes.decode('utf-8')
    return json.loads(message_json)

def test_query(query, variables=None, endpoint=None):
    """Test a GraphQL query"""
    # This would normally connect to the native host
    # But for testing, we can't directly connect - Chrome manages the connection
    # So we'll create a simple script that the user can run
    
    print("=" * 70)
    print("Native Host Test Client")
    print("=" * 70)
    print("\nNOTE: Native Messaging connections are managed by Chrome.")
    print("To test the native host:")
    print("1. Make sure the native host is installed (run install_native_host.bat)")
    print("2. Load the extension in Chrome")
    print("3. The extension will automatically connect to the native host")
    print("4. Use the Python API script to send queries")
    print("\n" + "=" * 70)

if __name__ == '__main__':
    query = """query MyQuery {
  allCourses {
    name
  }
}"""
    
    test_query(query)

