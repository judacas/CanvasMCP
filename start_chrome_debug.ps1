# PowerShell script to start Chrome with remote debugging on Windows
# This script tries to find Chrome in common installation locations

Write-Host "Searching for Chrome..." -ForegroundColor Cyan

$chromePath = $null

# Try common Chrome locations
$possiblePaths = @(
    "C:\Program Files\Google\Chrome\Application\chrome.exe",
    "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
    "C:\Program Files\Microsoft\Edge\Application\msedge.exe",
    "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
)

foreach ($path in $possiblePaths) {
    if (Test-Path $path) {
        $chromePath = $path
        if ($path -like "*Edge*") {
            Write-Host "Found Microsoft Edge instead of Chrome" -ForegroundColor Yellow
        }
        break
    }
}

# Try to find Chrome via registry
if (-not $chromePath) {
    try {
        $regPath = "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\chrome.exe"
        $chromePath = (Get-ItemProperty -Path $regPath -ErrorAction SilentlyContinue).'(default)'
        if ($chromePath -and (Test-Path $chromePath)) {
            Write-Host "Found Chrome via registry" -ForegroundColor Green
        } else {
            $chromePath = $null
        }
    } catch {
        # Registry lookup failed, continue
    }
}

if (-not $chromePath) {
    Write-Host "`nERROR: Could not find Chrome or Edge installation." -ForegroundColor Red
    Write-Host "`nPlease manually start Chrome with:" -ForegroundColor Yellow
    Write-Host '  "C:\Program Files\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222 --remote-allow-origins=*' -ForegroundColor White
    Write-Host "`nOr if using Edge:" -ForegroundColor Yellow
    Write-Host '  "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" --remote-debugging-port=9222 --remote-allow-origins=*' -ForegroundColor White
    Write-Host ""
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host "Found browser at: $chromePath" -ForegroundColor Green
Write-Host ""
Write-Host "Starting browser with remote debugging on port 9222..." -ForegroundColor Cyan
Write-Host "Close this window to stop the browser." -ForegroundColor Yellow
Write-Host ""

$userDataDir = Join-Path $env:TEMP "chrome_debug_profile"
Start-Process -FilePath $chromePath -ArgumentList "--remote-debugging-port=9222", "--remote-allow-origins=*", "--user-data-dir=$userDataDir"

Write-Host "Browser started! You can now:" -ForegroundColor Green
Write-Host "1. Open a Canvas page (usflearn.instructure.com) and log in" -ForegroundColor White
Write-Host "2. Load the queryForwarder extension" -ForegroundColor White
Write-Host "3. Start the test server: python test_server.py" -ForegroundColor White
Write-Host ""

