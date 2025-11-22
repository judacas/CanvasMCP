#!/usr/bin/env python3
"""
Simple HTTP server to test the queryForwarder Chrome extension.
Uses Chrome Remote Debugging Protocol (CDP) to communicate with the extension.
"""

from http.server import HTTPServer, BaseHTTPRequestHandler
import json
import subprocess
import time
import sys

try:
    import websocket
    HAS_WEBSOCKET = True
except ImportError:
    HAS_WEBSOCKET = False
    print("Warning: websocket-client not installed. Install with: pip install websocket-client")

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
                
                # Execute query via Chrome extension
                result = self._execute_via_extension(query, variables, endpoint)
                
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
    
    def _execute_via_extension(self, query, variables, endpoint):
        """Execute query by injecting JavaScript into Canvas page via CDP"""
        # This is a simplified approach - in practice, you'd use CDP properly
        # For now, we'll provide instructions on how to use it
        
        # The extension listens for chrome.runtime messages
        # We need to inject a script that sends the message
        # But we need the extension ID first
        
        raise NotImplementedError(
            "Direct HTTP communication with Chrome extensions requires Chrome Remote Debugging Protocol.\n"
            "Please use the test_client.py script instead, which opens a test page that communicates with the extension."
        )
    
    def log_message(self, format, *args):
        """Override to suppress default logging"""
        pass

def run_server(port=8765):
    """Run the HTTP server"""
    print("=" * 60)
    print("Query Forwarder Test Server")
    print("=" * 60)
    print(f"\nServer will run on http://localhost:{port}")
    print("\nNOTE: This server requires Chrome Remote Debugging Protocol setup.")
    print("For simpler testing, use test_client.py instead.")
    print("\nTo test with this server:")
    print("1. Start Chrome with remote debugging: chrome.exe --remote-debugging-port=9222")
    print("2. Open a Canvas page")
    print("3. Send POST requests to http://localhost:{port}/execute-query")
    print("\nExample:")
    print("""
import requests

response = requests.post('http://localhost:8765/execute-query', json={
    'query': 'query MyQuery { allCourses { name } }',
    'variables': {},
    'endpoint': 'https://usflearn.instructure.com/api/graphql'
})

print(response.json())
""")
    print("=" * 60)
    
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

