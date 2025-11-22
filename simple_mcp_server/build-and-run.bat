@echo off
echo Building Simple MCP Server Docker image...
docker build -t simple-mcp-server:latest .

if %errorlevel% neq 0 (
    echo Build failed! Make sure Docker Desktop is running.
    pause
    exit /b %errorlevel%
)

echo.
echo Build successful!
echo.
echo To run the server interactively (for testing):
echo docker run -i --rm simple-mcp-server:latest
echo.
echo To test it locally without Docker:
echo 1. Create venv: python -m venv venv
echo 2. Activate: venv\Scripts\activate
echo 3. Install deps: pip install -r requirements.txt
echo 4. Run: python -m app.server
echo.
pause

