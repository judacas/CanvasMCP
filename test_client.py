#!/usr/bin/env python3
"""
Simple test client for queryForwarder extension.
Opens a test page that communicates with the extension.
"""

import json
import webbrowser
import http.server
import socketserver
import threading
import time
from urllib.parse import urlparse, parse_qs

# Store the result
result = None
result_lock = threading.Lock()

class TestHandler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        if self.path == '/':
            # Serve the test page
            self.send_response(200)
            self.send_header('Content-type', 'text/html')
            self.end_headers()
            
            html = """<!DOCTYPE html>
<html>
<head>
    <title>Query Forwarder Test</title>
    <style>
        body { font-family: Arial, sans-serif; padding: 20px; }
        pre { background: #f5f5f5; padding: 10px; border-radius: 4px; }
        .status { padding: 10px; margin: 10px 0; border-radius: 4px; }
        .success { background: #d4edda; color: #155724; }
        .error { background: #f8d7da; color: #721c24; }
        .info { background: #d1ecf1; color: #0c5460; }
    </style>
</head>
<body>
    <h1>Query Forwarder Test</h1>
    <div id="status" class="status info">Waiting for query...</div>
    <pre id="result" style="display:none;"></pre>
    
    <script>
        // Get query from URL parameters
        const params = new URLSearchParams(window.location.search);
        const query = params.get('query') || '';
        const variablesStr = params.get('variables') || '{}';
        const endpoint = params.get('endpoint') || '';
        
        let variables = {};
        try {
            variables = JSON.parse(decodeURIComponent(variablesStr));
        } catch (e) {
            console.error('Failed to parse variables:', e);
        }
        
        if (!query) {
            document.getElementById('status').textContent = 'Error: No query provided';
            document.getElementById('status').className = 'status error';
        } else {
            document.getElementById('status').textContent = 'Sending query to extension...';
            
            // Generate request ID
            const requestId = 'req_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            
            // Set up listener for response
            const messageListener = (event) => {
                if (event.data && event.data.type === 'QUERY_FORWARDER_RESPONSE' && event.data.requestId === requestId) {
                    window.removeEventListener('message', messageListener);
                    
                    if (event.data.success) {
                        document.getElementById('status').textContent = 'Query executed successfully!';
                        document.getElementById('status').className = 'status success';
                        document.getElementById('result').textContent = JSON.stringify(event.data.data, null, 2);
                        document.getElementById('result').style.display = 'block';
                        sendResult(event.data);
                    } else {
                        document.getElementById('status').textContent = 'Error: ' + (event.data.error?.message || 'Unknown error');
                        document.getElementById('status').className = 'status error';
                        document.getElementById('result').textContent = JSON.stringify(event.data.error, null, 2);
                        document.getElementById('result').style.display = 'block';
                        sendResult(event.data);
                    }
                }
            };
            
            window.addEventListener('message', messageListener);
            
            // Send request via postMessage (content script will pick it up)
            // Note: This only works if we're on a Canvas page where the content script is loaded
            // For testing, open this page in an iframe on a Canvas page, or inject this script into a Canvas page
            document.getElementById('status').textContent = 'Sending query via postMessage... Make sure you are on a Canvas page!';
            
            window.postMessage({
                type: 'QUERY_FORWARDER_REQUEST',
                query: query,
                variables: variables,
                endpoint: endpoint || null,
                requestId: requestId
            }, '*');
            
            // Set timeout
            setTimeout(() => {
                window.removeEventListener('message', messageListener);
                if (document.getElementById('status').textContent.includes('Sending query')) {
                    document.getElementById('status').textContent = 'Timeout: No response from extension. Make sure you are on a Canvas page (usflearn.instructure.com) with the extension loaded.';
                    document.getElementById('status').className = 'status error';
                    sendResult({ success: false, error: { message: 'Timeout waiting for extension response' } });
                }
            }, 30000);
        }
        
        function sendResult(result) {
            // Send result back to Python server
            fetch('/result', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(result)
            }).catch(err => console.error('Failed to send result:', err));
        }
    </script>
</body>
</html>"""
            
            self.wfile.write(html.encode('utf-8'))
        elif self.path == '/result':
            # Return stored result
            with result_lock:
                if result is not None:
                    self.send_response(200)
                    self.send_header('Content-type', 'application/json')
                    self.end_headers()
                    self.wfile.write(json.dumps(result).encode('utf-8'))
                    global result
                    result = None  # Clear after reading
                else:
                    self.send_response(202)  # Accepted but not ready
                    self.send_header('Content-type', 'application/json')
                    self.end_headers()
                    self.wfile.write(json.dumps({'status': 'pending'}).encode('utf-8'))
        else:
            self.send_response(404)
            self.end_headers()
    
    def do_POST(self):
        if self.path == '/result':
            # Receive result from page
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            data = json.loads(post_data.decode('utf-8'))
            
            with result_lock:
                global result
                result = data
            
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'status': 'received'}).encode('utf-8'))
        else:
            self.send_response(404)
            self.end_headers()

def test_query(query, variables=None, endpoint=None, port=8765):
    """Test a GraphQL query"""
    # Start server
    handler = TestHandler
    httpd = socketserver.TCPServer(("", port), handler)
    server_thread = threading.Thread(target=httpd.serve_forever)
    server_thread.daemon = True
    server_thread.start()
    
    # Build URL
    url = f"http://localhost:{port}/?"
    url += f"query={query.replace(chr(10), ' ').replace(chr(13), ' ')}"
    if variables:
        url += f"&variables={json.dumps(variables)}"
    if endpoint:
        url += f"&endpoint={endpoint}"
    
    print(f"Opening test page: {url}")
    print("Make sure you have a Canvas page open in Chrome with the extension loaded!")
    print("Waiting for result...")
    
    # Open browser
    webbrowser.open(url)
    
    # Wait for result (with timeout)
    timeout = 30
    start_time = time.time()
    while True:
        time.sleep(0.5)
        with result_lock:
            if result is not None:
                httpd.shutdown()
                return result
        if time.time() - start_time > timeout:
            httpd.shutdown()
            raise TimeoutError("Request timed out after 30 seconds")
    
    httpd.shutdown()

if __name__ == '__main__':
    # Test query
    query = """query MyQuery {
  allCourses {
    name
  }
}"""
    
    try:
        result = test_query(
            query=query,
            endpoint='https://usflearn.instructure.com/api/graphql'
        )
        print("\n" + "="*60)
        print("RESULT:")
        print("="*60)
        print(json.dumps(result, indent=2))
    except Exception as e:
        print(f"\nError: {e}")

