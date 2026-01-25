@echo off
echo ====================================
echo Listen API - Windows
echo ====================================

cd /d %~dp0

echo Installing dependencies...
pip install -r requirements.txt

echo.
echo Starting server on http://localhost:8001
echo Press Ctrl+C to stop
echo.

python main.py
