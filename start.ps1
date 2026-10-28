# ============================================================
#  Campus Energy Analysis — One-command Dev Startup
#  Usage: Right-click > "Run with PowerShell"
#         OR from terminal: .\start.ps1
# ============================================================

$root    = $PSScriptRoot
$backend  = Join-Path $root "backend"
$frontend = Join-Path $root "frontend"

Write-Host ""
Write-Host "  Campus Energy Analysis — Dev Server" -ForegroundColor Cyan
Write-Host "  =====================================" -ForegroundColor Cyan
Write-Host ""

# ── 1. Start Flask backend in a new window ───────────────────
Write-Host "  [1/2] Starting Flask backend on http://localhost:5000 ..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList @(
  "-NoExit",
  "-Command",
  "Set-Location '$backend'; Write-Host ' Backend (Flask)' -ForegroundColor Cyan; .venv\Scripts\python.exe index.py"
)

# Give Flask a moment to bind before Vite tries to proxy it
Start-Sleep -Seconds 2

# ── 2. Start Vite frontend in a new window ────────────────────
Write-Host "  [2/2] Starting Vite frontend on http://localhost:5173 ..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList @(
  "-NoExit",
  "-Command",
  "Set-Location '$frontend'; Write-Host ' Frontend (Vite)' -ForegroundColor Cyan; npm run dev"
)

Write-Host ""
Write-Host "  Both servers are starting in separate windows." -ForegroundColor Green
Write-Host "  Open http://localhost:5173 in your browser." -ForegroundColor Green
Write-Host ""

