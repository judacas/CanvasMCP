#!/usr/bin/env python3
"""
Example usage of the queryForwarder extension via Native Messaging.

This demonstrates how to send GraphQL queries to the extension
using the native host socket server.
"""

import sys
import os

# Add native_host to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'native_host'))

from send_query import send_query
import json

def main():
    # Your GraphQL query
    query = """query MyQuery {
  allCourses {
    name
  }
}"""
    
    print("=" * 70)
    print("Canvas GraphQL Query Forwarder - Native Messaging Example")
    print("=" * 70)
    print("\nSending query to extension...")
    print(f"Query: {query.strip()}")
    print()
    
    try:
        result = send_query(
            query=query,
            variables={},
            endpoint='https://usflearn.instructure.com/api/graphql'
        )
        
        print("=" * 70)
        print("RESULT:")
        print("=" * 70)
        print(json.dumps(result, indent=2))
        
        if result.get('success'):
            print("\n✓ Query executed successfully!")
            if result.get('data'):
                print("\nData:")
                print(json.dumps(result['data'], indent=2))
        else:
            print(f"\n✗ Query failed: {result.get('error', {}).get('message', 'Unknown error')}")
            
    except ConnectionError as e:
        print(f"\n✗ Connection Error: {e}")
        print("\nMake sure:")
        print("1. The extension is loaded in Chrome")
        print("2. A Canvas page is open")
        print("3. The native host is installed (run install_native_host.bat)")
    except TimeoutError as e:
        print(f"\n✗ Timeout: {e}")
        print("\nThe extension may not be responding. Try:")
        print("1. Refresh the Canvas page")
        print("2. Check browser console for errors")
    except Exception as e:
        print(f"\n✗ Error: {e}")

if __name__ == '__main__':
    main()

