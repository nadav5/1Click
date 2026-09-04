@echo off
title 1-Click to Campaign Launcher
echo ========================================================
echo   Launching 1-Click to Campaign Dropshipping SaaS...
echo ========================================================
echo.

:: Get the directory where the batch file is located
set ROOT_DIR=%~dp0
cd /d "%ROOT_DIR%"

echo [1/2] Starting Backend (NestJS on http://localhost:3000)...
start "1Click - Backend (NestJS)" cmd /k "cd /d "%ROOT_DIR%backend" && npm.cmd run start:dev"

echo [2/2] Starting Frontend (Angular on http://localhost:4200)...
start "1Click - Frontend (Angular)" cmd /k "cd /d "%ROOT_DIR%frontend" && npm.cmd start"

echo.
echo Waiting 6 seconds for dev servers to initialize...
timeout /t 6 /nobreak >nul

echo Opening browser at http://localhost:4200...
start http://localhost:4200

echo.
echo ========================================================
echo   Both services are starting in dedicated terminal windows!
echo   - Frontend: http://localhost:4200
echo   - Backend:  http://localhost:3000
echo.
echo   To stop the servers, simply close their terminal windows.
echo ========================================================
pause
