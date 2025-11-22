#!/usr/bin/env python3
"""
Simple HTTP server for queryForwarder extension.
Provides a REST API endpoint that communicates with the extension via Chrome Remote Debugging Protocol.
"""

from http.server import HTTPServer, BaseHTTPRequestHandler
import json
import urllib.request
import urllib.parse

try:
    import websocket
    import json as json_lib
    HAS_WEBSOCKET = True
except ImportError:
    HAS_WEBSOCKET = False
    print("Warning: websocket-client not installed.")
    print("Install with: pip install websocket-client")
    print("Falling back to simpler method...")

class QueryHandler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        """Handle CORS preflight"""
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()
    
    def do_POST(self):
        """Handle POST requests to execute queries"""
        if self.path == '/execute-query':
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            
            try:
                data = json.loads(post_data.decode('utf-8'))
                query = data.get('query', '')
                variables = data.get('variables', {})
                endpoint = data.get('endpoint')
                
                # Execute query via extension
                result = self._execute_via_cdp(query, variables, endpoint)
                
                self.send_response(200)
                self.send_header('Content-type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(json.dumps(result).encode('utf-8'))
                
            except Exception as e:
                self.send_response(500)
                self.send_header('Content-type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                error_response = {
                    'success': False,
                    'error': {'message': str(e)}
                }
                self.wfile.write(json.dumps(error_response).encode('utf-8'))
        else:
            self.send_response(404)
            self.end_headers()
    
    def _execute_via_cdp(self, query, variables, endpoint):
        """Execute query using Chrome Remote Debugging Protocol"""
        if not HAS_WEBSOCKET:
            raise Exception(
                "websocket-client library required. Install with: pip install websocket-client\n"
                "Alternatively, use test_client.py which opens a browser page."
            )
        
        # Connect to Chrome DevTools Protocol
        cdp_url = "http://localhost:9222/json"
        try:
            with urllib.request.urlopen(cdp_url) as response:
                tabs = json.loads(response.read().decode('utf-8'))
        except Exception as e:
            raise Exception(
                f"Could not connect to Chrome DevTools Protocol on port 9222.\n"
                f"Start Chrome with: chrome.exe --remote-debugging-port=9222\n"
                f"Error: {e}"
            )
        
        # Find a Canvas tab
        canvas_tab = None
        for tab in tabs:
            url = tab.get('url', '')
            if 'instructure.com' in url or 'canvas' in url.lower():
                canvas_tab = tab
                break
        
        if not canvas_tab:
            raise Exception(
                "No Canvas tab found. Please open a Canvas page (usflearn.instructure.com) in Chrome."
            )
        
        # Connect to the tab's WebSocket
        ws_url = canvas_tab['webSocketDebuggerUrl']
        ws = websocket.create_connection(ws_url)
        
        try:
            # Generate request ID
            import time
            import random
            request_id = f"req_{int(time.time())}_{random.randint(1000, 9999)}"
            
            # Inject script that sends postMessage and waits for response
            script = f"""
            (function() {{
                return new Promise((resolve, reject) => {{
                    const requestId = {json.dumps(request_id)};
                    const query = {json.dumps(query)};
                    const variables = {json.dumps(variables)};
                    const endpoint = {json.dumps(endpoint)};
                    
                    // Set up listener
                    const listener = (event) => {{
                        if (event.data && event.data.type === 'QUERY_FORWARDER_RESPONSE' && 
                            event.data.requestId === requestId) {{
                            window.removeEventListener('message', listener);
                            resolve(JSON.stringify(event.data));
                        }}
                    }};
                    
                    window.addEventListener('message', listener);
                    
                    // Send request
                    window.postMessage({{
                        type: 'QUERY_FORWARDER_REQUEST',
                        query: query,
                        variables: variables,
                        endpoint: endpoint,
                        requestId: requestId
                    }}, '*');
                    
                    // Timeout
                    setTimeout(() => {{
                        window.removeEventListener('message', listener);
                        reject(new Error('Timeout waiting for extension response'));
                    }}, 30000);
                }});
            }})()
            """
            
            # Execute script via CDP
            execute_cmd = {
                "id": 1,
                "method": "Runtime.evaluate",
                "params": {
                    "expression": script,
                    "awaitPromise": True,
                    "returnByValue": True
                }
            }
            
            ws.send(json_lib.dumps(execute_cmd))
            response = json_lib.loads(ws.recv())
            
            if 'error' in response:
                raise Exception(f"CDP Error: {response['error']}")
            
            result_str = response.get('result', {}).get('value', '')
            if result_str:
                result = json.loads(result_str)
                return result
            else:
                raise Exception("No result from extension")
                
        finally:
            ws.close()
    
    def log_message(self, format, *args):
        """Override to suppress default logging"""
        pass

def run_server(port=8765):
    """Run the HTTP server"""
    print("=" * 70)
    print("Query Forwarder HTTP API Server")
    print("=" * 70)
    print(f"\nServer running on http://localhost:{port}")
    print("\nPrerequisites:")
    print("1. Start Chrome with remote debugging:")
    print("   chrome.exe --remote-debugging-port=9222")
    print("2. Open a Canvas page (usflearn.instructure.com)")
    print("3. Load the queryForwarder extension")
    print("\nTest endpoint: POST http://localhost:{port}/execute-query")
    print("\nExample usage:")
    print("""
import requests

response = requests.post('http://localhost:8765/execute-query', json={
    'query': 'query MyQuery { allCourses { name } }',
    'variables': {},
    'endpoint': 'https://usflearn.instructure.com/api/graphql'
})

print(response.json())
""")
    print("=" * 70)
    
    server = HTTPServer(('localhost', port), QueryHandler)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down server...")
        server.shutdown()

if __name__ == '__main__':
    import sys
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8765
    run_server(port)

