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
                f"Start Chrome with: chrome.exe --remote-debugging-port=9222 --remote-allow-origins=*\n"
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
                    
                    let resolved = false;
                    let timeoutId = null;
                    
                    // Set up listener BEFORE sending message
                    const listener = (event) => {{
                        // Log all messages for debugging
                        if (event.data && event.data.type) {{
                            console.log('[Injected Script] Received message type:', event.data.type, 'requestId:', event.data.requestId, 'expected:', requestId);
                        }}
                        
                        if (event.data && event.data.type === 'QUERY_FORWARDER_RESPONSE' && 
                            event.data.requestId === requestId) {{
                            if (!resolved) {{
                                resolved = true;
                                if (timeoutId) clearTimeout(timeoutId);
                                window.removeEventListener('message', listener);
                                console.log('[Injected Script] Resolving with result:', event.data);
                                resolve(JSON.stringify(event.data));
                            }}
                        }}
                    }};
                    
                    // Add listener first
                    window.addEventListener('message', listener);
                    console.log('[Injected Script] Listener registered, requestId:', requestId);
                    
                    // Send request immediately (listener is already set up)
                    console.log('[Injected Script] Sending QUERY_FORWARDER_REQUEST');
                    window.postMessage({{
                        type: 'QUERY_FORWARDER_REQUEST',
                        query: query,
                        variables: variables,
                        endpoint: endpoint,
                        requestId: requestId
                    }}, '*');
                    
                    // Also try dispatching a custom event to ensure content script sees it
                    window.dispatchEvent(new CustomEvent('queryForwarderRequest', {{
                        detail: {{
                            type: 'QUERY_FORWARDER_REQUEST',
                            query: query,
                            variables: variables,
                            endpoint: endpoint,
                            requestId: requestId
                        }}
                    }}));
                    
                    // Timeout
                    timeoutId = setTimeout(() => {{
                        if (!resolved) {{
                            resolved = true;
                            window.removeEventListener('message', listener);
                            console.error('[Injected Script] Timeout - no response received');
                            reject(new Error('Timeout waiting for extension response after 30 seconds. Check browser console for details.'));
                        }}
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
            
            # Check for exception in the result
            result_obj = response.get('result', {})
            
            # Debug: Check what we actually got
            if not result_obj:
                raise Exception(f"Empty result object. Full response: {json.dumps(response, indent=2)}")
            
            # Handle nested result structure (sometimes CDP nests it)
            if 'result' in result_obj and isinstance(result_obj.get('result'), dict):
                result_obj = result_obj['result']
            
            if result_obj.get('exceptionDetails'):
                exception = result_obj.get('exceptionDetails', {})
                error_msg = exception.get('exception', {}).get('description', 'Unknown error')
                raise Exception(f"Script execution error: {error_msg}")
            
            # Get the value - it should be a JSON string
            # CDP returns result as: {"type": "string", "value": "..."}
            result_type = result_obj.get('type', 'unknown')
            
            # Check if 'value' key exists (even if it's an empty string)
            if 'value' not in result_obj:
                raise Exception(f"No 'value' key in result. Type: {result_type}, Full result_obj: {json.dumps(result_obj, indent=2)[:1000]}")
            
            result_str = result_obj['value']
            
            # result_str should be a string containing JSON
            if isinstance(result_str, str):
                if not result_str.strip():
                    raise Exception(f"Result value is empty string. Type: {result_type}, Full result_obj: {json.dumps(result_obj, indent=2)[:500]}")
                try:
                    result = json.loads(result_str)
                    return result
                except json.JSONDecodeError as e:
                    raise Exception(f"Failed to parse result as JSON. First 200 chars: {result_str[:200]}... Error: {e}")
            else:
                # If it's not a string, return it directly (shouldn't happen but handle it)
                return result_str
                
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
    print("   chrome.exe --remote-debugging-port=9222 --remote-allow-origins=*")
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

