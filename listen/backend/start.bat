@echo off
echo ====================================
echo Listen API - Windows
echo ====================================

cd /d %~dp0

echo Installing dependencies...
pip install -r requirements.txt

@REM echo.
@REM echo Checking Whisper model...
@REM set WHISPER_CACHE=%USERPROFILE%\.cache\whisper
@REM set WHISPER_MODEL=%WHISPER_CACHE%\base.pt

@REM if not exist "%WHISPER_CACHE%" (
@REM     echo Creating Whisper cache directory...
@REM     mkdir "%WHISPER_CACHE%"
@REM )

@REM if exist "%WHISPER_MODEL%" (
@REM     echo Whisper model already exists, skipping download.
@REM ) else (
@REM     echo Downloading Whisper base model ^(~140MB^)...
@REM     curl -L -o "%WHISPER_MODEL%" "https://huggingface.co/openai/whisper-base/resolve/main/pytorch_model.bin"
@REM     if errorlevel 1 (
@REM         echo WARNING: Failed to download Whisper model. Transcription may fail.
@REM     ) else (
@REM         echo Whisper model downloaded successfully.
@REM     )
@REM )

echo.
echo Starting server on http://localhost:8001
echo Press Ctrl+C to stop
echo.

python main.py
