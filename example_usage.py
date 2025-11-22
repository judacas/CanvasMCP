#!/usr/bin/env python3
"""
Example usage of the queryForwarder HTTP API.

Prerequisites:
1. Start Chrome with: chrome.exe --remote-debugging-port=9222
2. Open a Canvas page (usflearn.instructure.com) and log in
3. Load the queryForwarder extension
4. Start the test server: python test_server.py
5. Run this script: python example_usage.py
"""

import requests
import json

# API endpoint
API_URL = "http://localhost:8765/execute-query"

# Your GraphQL query
query = """query MyQuery {
  allCourses {
    name
  }
}"""

# Optional: GraphQL variables
variables = {}

# Optional: Custom endpoint (defaults to https://usflearn.instructure.com/api/graphql)
endpoint = "https://usflearn.instructure.com/api/graphql"

def test_query():
    """Test the GraphQL query"""
    print("Sending query to extension...")
    print(f"Query: {query.strip()}")
    print()
    
    try:
        response = requests.post(API_URL, json={
            'query': query,
            'variables': variables,
            'endpoint': endpoint
        }, timeout=35)
        
        response.raise_for_status()
        result = response.json()
        
        print("=" * 70)
        print("RESULT:")
        print("=" * 70)
        print(json.dumps(result, indent=2))
        
        if result.get('success'):
            print("\n✓ Query executed successfully!")
        else:
            print(f"\n✗ Query failed: {result.get('error', {}).get('message', 'Unknown error')}")
            
    except requests.exceptions.ConnectionError:
        print("Error: Could not connect to test server.")
        print("Make sure test_server.py is running on port 8765")
    except requests.exceptions.Timeout:
        print("Error: Request timed out. The extension may not be responding.")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == '__main__':
    test_query()

