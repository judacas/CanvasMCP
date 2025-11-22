# Simple MCP Server

A minimal MCP (Model Context Protocol) server with dummy tools for testing connectivity with ChatGPT and other LLM clients.

## Features

This server provides three simple tools:

1. **echo** - Echoes back a message with a timestamp
2. **add_numbers** - Adds two numbers together
3. **get_random_fact** - Returns a hardcoded fun fact

## Quick Start

### Option 1: Run with Docker (Recommended)

1. **Build the Docker image:**
   ```bash
   cd simple_mcp_server
   docker build -t simple-mcp-server:latest .
   ```

2. **Run the container:**
   ```bash
   docker run -i --rm simple-mcp-server:latest
   ```

### Option 2: Run Bare-Metal (Local Development)

1. **Create and activate a virtual environment:**
   ```bash
   cd simple_mcp_server
   python -m venv venv
   
   # Windows
   venv\Scripts\activate
   
   # Linux/Mac
   source venv/bin/activate
   ```

2. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

3. **Run the server:**
   ```bash
   python -m app.server
   ```

## Connecting to ChatGPT

To connect this MCP server to ChatGPT or other MCP clients:

### For ChatGPT Desktop (when available)

Add to your MCP configuration file (typically `~/Library/Application Support/ChatGPT/mcp_config.json` on Mac or `%APPDATA%\ChatGPT\mcp_config.json` on Windows):

```json
{
  "mcpServers": {
    "simple-mcp": {
      "command": "docker",
      "args": [
        "run",
        "-i",
        "--rm",
        "simple-mcp-server:latest"
      ]
    }
  }
}
```

### For Claude Desktop

Add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "simple-mcp": {
      "command": "docker",
      "args": [
        "run",
        "-i",
        "--rm",
        "simple-mcp-server:latest"
      ]
    }
  }
}
```

### For Cursor or Other Editors

Follow your editor's MCP configuration instructions, using the Docker command:
```bash
docker run -i --rm simple-mcp-server:latest
```

## Testing the Tools

Once connected, you can ask your LLM client to use the tools:

- "Can you echo the message 'Hello MCP'?"
- "Please add 42 and 58 together"
- "Tell me a science fact"

## Project Structure

```
simple_mcp_server/
├── app/
│   ├── __init__.py
│   ├── config.py            # Settings & configuration
│   ├── server.py            # FastMCP server definition
│   ├── tools/
│   │   ├── __init__.py
│   │   └── simple_tools.py  # Dummy tools
│   └── utils/
│       └── __init__.py
├── .env.example             # Template for env vars
├── .gitignore
├── requirements.txt
├── Dockerfile
└── README.md
```

## Troubleshooting

### Docker Issues
- Make sure Docker is running: `docker --version`
- If build fails, try: `docker system prune` to clean up

### Connection Issues
- Verify the server is running: check for startup logs
- Ensure your MCP client supports the stdio transport
- Check that the Docker image name matches your config

## Next Steps

This is a minimal server for testing. To build a real MCP server:

1. Replace dummy tools with real API calls
2. Add authentication/authorization
3. Implement proper error handling
4. Add more sophisticated tools based on your needs

## Resources

- [MCP Documentation](https://modelcontextprotocol.io/)
- [FastMCP GitHub](https://github.com/jlowin/fastmcp)
- [MCP Specification](https://spec.modelcontextprotocol.io/)

