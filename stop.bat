@echo off
title 1-Click Stopper
echo Stopping any running backend and frontend node servers...
taskkill /F /IM node.exe /T 2>nul
echo Done! All development servers stopped.
pause
