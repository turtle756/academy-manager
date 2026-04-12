@echo off
chcp 65001 > nul
cd /d "%~dp0"

REM Remove Zone.Identifier (SmartScreen block)
powershell -NoProfile -Command "Get-ChildItem -Path '%~dp0' -Recurse | Unblock-File" > nul 2>&1

echo.
echo ClassManager NFC Kiosk starting...
echo.

if not exist "%~dp0relay.py" (
    echo FAIL: relay.py not found
    pause & exit /b 1
)
if not exist "%~dp0server.py" (
    echo FAIL: server.py not found
    pause & exit /b 1
)

set PYTHON_CMD=
python --version > nul 2>&1
if %errorlevel% == 0 (
    set PYTHON_CMD=python
    goto :run
)
py --version > nul 2>&1
if %errorlevel% == 0 (
    set PYTHON_CMD=py
    goto :run
)

echo FAIL: Python not installed.
echo Install Python 3.8+ from https://www.python.org/downloads/
echo Make sure to check "Add Python to PATH" during install.
pause & exit /b 1

:run
start "" http://localhost:8888
%PYTHON_CMD% server.py
pause
