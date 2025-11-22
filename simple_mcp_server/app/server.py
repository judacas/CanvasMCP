# app/server.py
import sys
import logging
from fastmcp import FastMCP
from app.config import settings
from app.tools.simple_tools import register_simple_tools

# Logging
logging.basicConfig(
    level=getattr(logging, settings.LOG_LEVEL),
    format="%(asctime)s - %(levelname)s - %(name)s - %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)
logger = logging.getLogger(__name__)

# Create MCP server instance
mcp = FastMCP(
    name=settings.SERVER_NAME,
    logger=logger,
)

# Register tools
register_simple_tools(mcp)

# Simple resources for health & metadata
@mcp.resource("health://status")
def health_status() -> dict:
    """Basic health check for the MCP server."""
    return {
        "status": "ok",
        "version": settings.SERVER_VERSION,
    }

@mcp.resource("config://server-info")
def server_info() -> dict:
    """Server metadata and capabilities."""
    return {
        "name": settings.SERVER_NAME,
        "version": settings.SERVER_VERSION,
        "description": "Simple MCP server with dummy tools for testing connectivity.",
    }

if __name__ == "__main__":
    logger.info(f"Starting {settings.SERVER_NAME} v{settings.SERVER_VERSION}")
    logger.info(f"Listening on port {settings.PORT}")
    
    # Run server
    mcp.run()

