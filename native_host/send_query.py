#!/usr/bin/env python3
"""
Send a GraphQL query to the extension via the native host.

This script connects to the native host's socket server (port 8766)
to send queries and receive results.
"""

import json
import sys
import socket
import uuid

def send_query(query, variables=None, endpoint=None, timeout=30):
    """
    Send a query to the extension via the native host socket server.
    
    Args:
        query: GraphQL query string
        variables: Optional GraphQL variables dict
        endpoint: Optional GraphQL endpoint URL
        timeout: Timeout in seconds
    
    Returns:
        Query result dict
    """
    # Generate unique request ID
    request_id = str(uuid.uuid4())
    
    query_data = {
        'id': request_id,
        'query': query,
        'variables': variables or {},
        'endpoint': endpoint
    }
    
    # Connect to native host socket server
    try:
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(timeout)
        sock.connect(('localhost', 8766))
        
        # Send query
        query_json = json.dumps(query_data)
        sock.sendall(query_json.encode('utf-8'))
        
        # Receive response
        response_data = b''
        while True:
            chunk = sock.recv(4096)
            if not chunk:
                break
            response_data += chunk
            # Try to parse JSON - if successful, we're done
            try:
                result = json.loads(response_data.decode('utf-8'))
                sock.close()
                return result
            except json.JSONDecodeError:
                # Need more data
                continue
        
        # If we get here, try to parse what we have
        result = json.loads(response_data.decode('utf-8'))
        sock.close()
        return result
        
    except socket.timeout:
        raise TimeoutError(f"Query timed out after {timeout} seconds")
    except ConnectionRefusedError:
        raise ConnectionError(
            "Could not connect to native host on port 8766.\n"
            "Make sure:\n"
            "1. The extension is loaded in Chrome\n"
            "2. A Canvas page is open\n"
            "3. The native host is running (Chrome starts it automatically)"
        )
    except Exception as e:
        raise Exception(f"Error communicating with native host: {e}")

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("Usage: python send_query.py '<graphql_query>' [variables_json] [endpoint]")
        print("\nExample:")
        print('  python send_query.py "query { allCourses { name } }"')
        sys.exit(1)
    
    query = sys.argv[1]
    variables = json.loads(sys.argv[2]) if len(sys.argv) > 2 else {}
    endpoint = sys.argv[3] if len(sys.argv) > 3 else None
    
    try:
        result = send_query(query, variables, endpoint)
        print("\n" + "=" * 70)
        print("RESULT:")
        print("=" * 70)
        print(json.dumps(result, indent=2))
    except Exception as e:
        print(f"\nError: {e}")
        sys.exit(1)

