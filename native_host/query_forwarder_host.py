#!/usr/bin/env python3
"""
Native Messaging Host for Canvas GraphQL Query Forwarder Extension.

This script communicates with the Chrome extension via stdin/stdout using
Chrome's Native Messaging protocol, and also runs a local socket server
for external Python scripts to send queries.

Protocol:
- Messages are JSON objects
- First 4 bytes: message length (32-bit little-endian integer)
- Then: JSON message (UTF-8 encoded)

The native host acts as a bridge:
1. Receives queries from external scripts via local socket (port 8766)
2. Forwards queries to extension via Native Messaging
3. Receives results from extension and forwards to external scripts
"""

import sys
import json
import struct
import os
import threading
import socket
import socketserver

# Store pending queries and their results
pending_queries = {}
query_lock = threading.Lock()
extension_connected = False

def send_message(message):
    """Send a message to Chrome extension via stdout"""
    message_json = json.dumps(message)
    message_bytes = message_json.encode('utf-8')
    
    # Write message length (4 bytes, little-endian)
    sys.stdout.buffer.write(struct.pack('<I', len(message_bytes)))
    # Write message
    sys.stdout.buffer.write(message_bytes)
    sys.stdout.buffer.flush()

def read_message():
    """Read a message from Chrome extension via stdin"""
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

def handle_extension_message(message):
    """Handle messages from the extension"""
    global extension_connected
    
    msg_type = message.get('type')
    
    if msg_type == 'connected':
        extension_connected = True
        print("Extension connected", file=sys.stderr)
    elif msg_type == 'response':
        # Extension is sending a query result
        query_id = message.get('id')
        with query_lock:
            if query_id in pending_queries:
                # Send result to waiting socket client
                client_socket = pending_queries[query_id].get('socket')
                if client_socket:
                    try:
                        response_json = json.dumps(message)
                        client_socket.sendall(response_json.encode('utf-8'))
                        client_socket.close()
                    except:
                        pass
                del pending_queries[query_id]
    elif msg_type == 'ping':
        # Extension is checking if we're alive
        send_message({
            'type': 'pong'
        })

class QueryHandler(socketserver.BaseRequestHandler):
    """Handle queries from external Python scripts"""
    
    def handle(self):
        global extension_connected
        
        # Read query from socket
        data = self.request.recv(4096).decode('utf-8')
        if not data:
            return
        
        try:
            query_data = json.loads(data)
            query_id = query_data.get('id') or str(os.getpid()) + '_' + str(len(pending_queries))
            
            # Store query with socket for response
            with query_lock:
                pending_queries[query_id] = {
                    'socket': self.request,
                    'query': query_data.get('query'),
                    'variables': query_data.get('variables', {}),
                    'endpoint': query_data.get('endpoint')
                }
            
            # Forward to extension
            send_message({
                'id': query_id,
                'type': 'query',
                'query': query_data.get('query'),
                'variables': query_data.get('variables', {}),
                'endpoint': query_data.get('endpoint')
            })
            
            # Wait for response (socket will be closed when response arrives)
            # For now, we'll keep the connection open and close it when response arrives
            
        except json.JSONDecodeError:
            self.request.sendall(json.dumps({
                'success': False,
                'error': {'message': 'Invalid JSON'}
            }).encode('utf-8'))
            self.request.close()
        except Exception as e:
            self.request.sendall(json.dumps({
                'success': False,
                'error': {'message': str(e)}
            }).encode('utf-8'))
            self.request.close()

def start_socket_server():
    """Start socket server for external queries"""
    server = socketserver.TCPServer(('localhost', 8766), QueryHandler)
    server.allow_reuse_address = True
    print("Socket server started on localhost:8766", file=sys.stderr)
    server.serve_forever()

def main():
    """Main message loop - reads from extension"""
    global extension_connected
    
    # Start socket server in background thread
    socket_thread = threading.Thread(target=start_socket_server, daemon=True)
    socket_thread.start()
    
    try:
        # Send initial message to extension
        send_message({
            'type': 'ready',
            'message': 'Native host ready, socket server on port 8766'
        })
        
        while True:
            # Read message from extension
            message = read_message()
            
            if message is None:
                break
            
            # Handle the message
            handle_extension_message(message)
                
    except KeyboardInterrupt:
        pass
    except Exception as e:
        print(f"Error in native host: {e}", file=sys.stderr)
        try:
            send_message({
                'type': 'error',
                'message': str(e)
            })
        except:
            pass
        sys.exit(1)

if __name__ == '__main__':
    # On Windows, stdin/stdout might be in text mode, so we need binary mode
    if sys.platform == 'win32':
        import msvcrt
        msvcrt.setmode(sys.stdin.fileno(), os.O_BINARY)
        msvcrt.setmode(sys.stdout.fileno(), os.O_BINARY)
    
    main()

