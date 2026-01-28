#!/bin/bash
echo "===================================="
echo "Listen API - Linux"
echo "===================================="

cd "$(dirname "$0")"

echo "Installing dependencies..."
pip3 install -r requirements.txt

echo ""
echo "Checking Whisper model..."
WHISPER_CACHE="$HOME/.cache/whisper"
WHISPER_MODEL="$WHISPER_CACHE/base.pt"

if [ ! -d "$WHISPER_CACHE" ]; then
    echo "Creating Whisper cache directory..."
    mkdir -p "$WHISPER_CACHE"
fi

if [ -f "$WHISPER_MODEL" ]; then
    echo "Whisper model found."
else
    echo "WARNING: Whisper model not found at $WHISPER_MODEL"
    echo "Please upload the model file using:"
    echo "  scp C:\\Users\\weizh\\.cache\\whisper\\base.pt root@<server>:$WHISPER_CACHE/"
fi

echo ""
echo "Starting server on http://0.0.0.0:8001"
echo "Press Ctrl+C to stop"
echo ""

python3 main.py
