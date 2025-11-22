@echo off
REM Helper script to start Chrome with remote debugging on Windows
REM This script tries to find Chrome in common installation locations

echo Searching for Chrome...

REM Try common Chrome locations
set CHROME_PATH=

if exist "C:\Program Files\Google\Chrome\Application\chrome.exe" (
    set CHROME_PATH=C:\Program Files\Google\Chrome\Application\chrome.exe
    goto :found
)

if exist "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe" (
    set CHROME_PATH=C:\Program Files (x86)\Google\Chrome\Application\chrome.exe
    goto :found
)

REM Try to find Chrome via registry (more reliable)
for /f "tokens=2*" %%a in ('reg query "HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\chrome.exe" /ve 2^>nul') do set CHROME_PATH=%%b

if exist "%CHROME_PATH%" (
    goto :found
)

REM Try Edge (which also supports Chrome extensions and CDP)
if exist "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" (
    set CHROME_PATH=C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe
    echo Found Microsoft Edge instead of Chrome
    goto :found
)

if exist "C:\Program Files\Microsoft\Edge\Application\msedge.exe" (
    set CHROME_PATH=C:\Program Files\Microsoft\Edge\Application\msedge.exe
    echo Found Microsoft Edge instead of Chrome
    goto :found
)

echo ERROR: Could not find Chrome or Edge installation.
echo.
echo Please manually start Chrome with:
echo   "C:\Program Files\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222 --remote-allow-origins=*
echo.
echo Or if using Edge:
echo   "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" --remote-debugging-port=9222 --remote-allow-origins=*
echo.
pause
exit /b 1

:found
echo Found browser at: %CHROME_PATH%
echo.
echo Starting browser with remote debugging on port 9222...
echo Close this window to stop the browser.
echo.
start "" "%CHROME_PATH%" --remote-debugging-port=9222 --remote-allow-origins=* --user-data-dir="%TEMP%\chrome_debug_profile"
pause

