@echo off
chcp 65001 > nul
cd /d "%~dp0"

echo.
echo === ClassManager Build Diagnostics ===
echo.

echo [1] Python check...
python --version
if %errorlevel% == 0 (
    set PYTHON_CMD=python
    goto :python_ok
)
py --version
if %errorlevel% == 0 (
    set PYTHON_CMD=py
    goto :python_ok
)
echo FAIL: Python not found
set PYTHON_CMD=
goto :pyinstaller_skip

:python_ok
echo OK: %PYTHON_CMD%
echo.

echo [2] PyInstaller check...
%PYTHON_CMD% -m PyInstaller --version
if %errorlevel% == 0 (
    echo OK: PyInstaller found
) else (
    echo Installing PyInstaller...
    %PYTHON_CMD% -m pip install pyinstaller
)
echo.

echo [3] File check...
if exist "server.py" (echo OK: server.py) else (echo MISSING: server.py)
if exist "relay.py"  (echo OK: relay.py)  else (echo MISSING: relay.py)
if exist "classmanager_kiosk.spec" (echo OK: spec file) else (echo MISSING: spec file)
echo.

echo [4] Inno Setup check...
if exist "C:\Program Files (x86)\Inno Setup 6\ISCC.exe" (
    echo OK: Inno Setup 6 found
) else if exist "C:\Program Files\Inno Setup 6\ISCC.exe" (
    echo OK: Inno Setup 6 found
) else (
    echo NOT FOUND: Install from https://jrsoftware.org/isdl.php
)
echo.

echo [5] PyInstaller build test...
%PYTHON_CMD% -m PyInstaller classmanager_kiosk.spec --clean --noconfirm
if %errorlevel% == 0 (
    echo OK: Build succeeded
) else (
    echo FAIL: Build failed - see errors above
)
echo.

:pyinstaller_skip
echo === Done ===
pause
