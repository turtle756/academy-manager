@echo off
chcp 65001 > nul
cd /d "%~dp0"

echo.
echo === ClassManager NFC Kiosk - Build Installer ===
echo.

REM Python check
set PYTHON_CMD=
python --version > nul 2>&1
if %errorlevel% == 0 (
    set PYTHON_CMD=python
    goto :python_found
)
py --version > nul 2>&1
if %errorlevel% == 0 (
    set PYTHON_CMD=py
    goto :python_found
)
echo FAIL: Python not found. Install from https://www.python.org/downloads/
pause & exit /b 1

:python_found
echo OK: Python found (%PYTHON_CMD%)

REM PyInstaller check
%PYTHON_CMD% -m PyInstaller --version > nul 2>&1
if %errorlevel% neq 0 (
    echo Installing PyInstaller...
    %PYTHON_CMD% -m pip install pyinstaller
    if %errorlevel% neq 0 (
        echo FAIL: Could not install PyInstaller
        pause & exit /b 1
    )
)
echo OK: PyInstaller ready

REM Step 1: PyInstaller build (TEMP 폴더에 빌드 - OneDrive 충돌 방지)
echo.
echo [1/2] Building EXE with PyInstaller...
set BUILD_OUT=%TEMP%\classmanager_kiosk_dist
%PYTHON_CMD% -m PyInstaller classmanager_kiosk.spec --clean --noconfirm --distpath "%BUILD_OUT%" --workpath "%TEMP%\classmanager_kiosk_build"
if %errorlevel% neq 0 (
    echo FAIL: PyInstaller build failed
    pause & exit /b 1
)
if not exist "%BUILD_OUT%\ClassManager_Kiosk.exe" (
    echo FAIL: EXE not found after build
    pause & exit /b 1
)

REM dist 폴더로 복사
if not exist "dist" mkdir dist
copy /y "%BUILD_OUT%\ClassManager_Kiosk.exe" "dist\ClassManager_Kiosk.exe" > nul
echo OK: dist\ClassManager_Kiosk.exe created

REM Step 2: Inno Setup
echo.
echo [2/2] Building installer with Inno Setup...

set ISCC=
if exist "C:\Program Files (x86)\Inno Setup 6\ISCC.exe" set ISCC=C:\Program Files (x86)\Inno Setup 6\ISCC.exe
if exist "C:\Program Files\Inno Setup 6\ISCC.exe"       set ISCC=C:\Program Files\Inno Setup 6\ISCC.exe

if "%ISCC%"=="" (
    echo.
    echo NOT FOUND: Inno Setup 6
    echo Install from: https://jrsoftware.org/isdl.php
    echo Then run this script again.
    echo.
    echo NOTE: EXE is ready at dist\ClassManager_Kiosk.exe
    pause & exit /b 1
)

"%ISCC%" installer.iss
if %errorlevel% neq 0 (
    echo FAIL: Inno Setup build failed
    pause & exit /b 1
)

echo.
echo === Build Complete ===
echo Output: dist\ClassManager_Kiosk_Setup.exe
echo.
pause
