@echo off
REM Install native host manifest for Windows
REM This script registers the native host with Chrome

echo ========================================
echo Native Host Installer for Query Forwarder
echo ========================================
echo.
echo This script will:
echo 1. Find your Python installation
echo 2. Register the native host with Chrome
echo 3. Set up communication between extension and Python
echo.
pause

setlocal

REM Get the absolute path to this script's directory
set SCRIPT_DIR=%~dp0
set NATIVE_HOST_PATH=%SCRIPT_DIR%query_forwarder_host.py

REM Get Python executable
set PYTHON_EXE=
where python >nul 2>&1
if %ERRORLEVEL% == 0 (
    for /f "delims=" %%i in ('where python') do set PYTHON_EXE=%%i
)

if "%PYTHON_EXE%"=="" (
    echo.
    echo ERROR: Python not found in PATH
    echo Please install Python or add it to PATH
    echo.
    pause
    exit /b 1
)

echo Python found: %PYTHON_EXE%
echo Native host script: %NATIVE_HOST_PATH%
echo.

REM Get extension ID from user
echo ========================================
echo Extension ID Required
echo ========================================
echo.
echo To get your Extension ID:
echo 1. Open Chrome
echo 2. Go to chrome://extensions/
echo 3. Find "Canvas GraphQL Query Forwarder"
echo 4. Copy the ID shown under the extension name
echo    (It looks like: abcdefghijklmnopqrstuvwxyz123456)
echo.
set /p EXTENSION_ID="Enter your Extension ID: "

if "%EXTENSION_ID%"=="" (
    echo.
    echo ERROR: Extension ID is required!
    echo.
    pause
    exit /b 1
)

REM Determine Chrome native messaging host directory
set CHROME_NATIVE_HOST_DIR=%LOCALAPPDATA%\Google\Chrome\User Data\NativeMessagingHosts

REM Create directory if it doesn't exist
if not exist "%CHROME_NATIVE_HOST_DIR%" (
    mkdir "%CHROME_NATIVE_HOST_DIR%"
)

echo.
echo Installing native host...
echo.

REM Create the native host manifest using Python
python -c "import json; import os; manifest = {'name': 'com.canvasmcp.queryforwarder', 'description': 'Native host for Canvas GraphQL Query Forwarder', 'path': r'%PYTHON_EXE%', 'args': [r'%NATIVE_HOST_PATH%'], 'type': 'stdio', 'allowed_origins': ['chrome-extension://%EXTENSION_ID%/']}; json.dump(manifest, open(r'%CHROME_NATIVE_HOST_DIR%\com.canvasmcp.queryforwarder.json', 'w'), indent=2)"

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo ERROR: Failed to create manifest file
    echo.
    pause
    exit /b 1
)

echo.
echo ========================================
echo Installation Complete!
echo ========================================
echo.
echo Native host installed at:
echo %CHROME_NATIVE_HOST_DIR%\com.canvasmcp.queryforwarder.json
echo.
echo Next steps:
echo 1. Make sure the extension is loaded in Chrome
echo 2. Open a Canvas page (usflearn.instructure.com)
echo 3. Run: python example_native_usage.py
echo.
pause

