# Dockerfile
FROM python:3.11-slim

WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY app ./app

# Expose HTTP port (if using HTTP transport)
EXPOSE 8000

ENV PYTHONUNBUFFERED=1

# Default command: run via FastMCP CLI using stdio (for MCP clients)
CMD ["python", "-m", "app.server"]

