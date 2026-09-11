param(
  [string]$WebUrl = "",
  [string]$TrackerToken = ""
)

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "OVERPOWERED / CLIMB LIVE TRACKER" -ForegroundColor Green
Write-Host "Silent match recording for post-game review. No live shotcalling." -ForegroundColor DarkGray
Write-Host ""

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Write-Host "Node.js was not found. Install Node.js 22 or newer, then run this file again." -ForegroundColor Red
  exit 1
}

if ([string]::IsNullOrWhiteSpace($WebUrl)) {
  $WebUrl = Read-Host "CLIMB web address (for example https://your-domain.com)"
}
if ([string]::IsNullOrWhiteSpace($TrackerToken)) {
  $secure = Read-Host "One-time tracker token from the Live Tracker page" -AsSecureString
  $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  try {
    $TrackerToken = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)
  } finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)
  }
}

if ([string]::IsNullOrWhiteSpace($WebUrl) -or [string]::IsNullOrWhiteSpace($TrackerToken)) {
  Write-Host "Web address and tracker token are required." -ForegroundColor Red
  exit 1
}

$env:OP_WEB_URL = $WebUrl.TrimEnd('/')
$env:OP_TRACKER_TOKEN = $TrackerToken

Write-Host ""
Write-Host "Connected to $($env:OP_WEB_URL)." -ForegroundColor Green
Write-Host "Leave this window open while you play League. Press Ctrl+C to stop." -ForegroundColor DarkGray
Write-Host ""

node "$PSScriptRoot\src\main.mjs"
