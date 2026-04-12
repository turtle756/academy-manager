@echo off
cd /d "%~dp0"
echo Running ClassManager_Kiosk.exe...
dist\ClassManager_Kiosk.exe
echo.
echo Exit code: %errorlevel%
pause
