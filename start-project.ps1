# 1-Click Project Launcher (PowerShell)
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "   Launching 1-Click to Campaign Dropshipping SaaS...  " -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan

$rootDir = $PSScriptRoot
if (-not $rootDir) {
    $rootDir = (Get-Location).Path
}

Write-Host "`n[1/2] Starting NestJS Backend (http://localhost:3000)..." -ForegroundColor Yellow
Start-Process cmd.exe -ArgumentList "/k cd /d `"$rootDir\backend`" && npm.cmd run start:dev"

Write-Host "[2/2] Starting Angular Frontend (http://localhost:4200)..." -ForegroundColor Yellow
Start-Process cmd.exe -ArgumentList "/k cd /d `"$rootDir\frontend`" && npm.cmd start"

Write-Host "`nWaiting 6 seconds for dev servers to boot..." -ForegroundColor Gray
Start-Sleep -Seconds 6

Write-Host "Opening http://localhost:4200 in default browser..." -ForegroundColor Green
Start-Process "http://localhost:4200"

Write-Host "`n========================================================" -ForegroundColor Cyan
Write-Host "   Services running in dedicated terminal windows!      " -ForegroundColor Cyan
Write-Host "   - Frontend: http://localhost:4200                    " -ForegroundColor White
Write-Host "   - Backend:  http://localhost:3000                    " -ForegroundColor White
Write-Host "   To stop the servers, close their terminal windows.   " -ForegroundColor Gray
Write-Host "========================================================" -ForegroundColor Cyan
