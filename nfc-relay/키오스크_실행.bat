@echo off
chcp 65001 > nul
cd /d "%~dp0"
echo.
echo   ClassManager NFC 키오스크 서버 시작 중...
echo.
start "" http://localhost:8888
python server.py
pause
