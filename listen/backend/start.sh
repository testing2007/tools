#!/bin/bash
echo "===================================="
echo "Listen API - Linux"
echo "===================================="

cd "$(dirname "$0")"

echo "Installing dependencies..."
pip3 install -r requirements.txt

echo ""
echo "Starting server on http://0.0.0.0:8001"
echo "Press Ctrl+C to stop"
echo ""

python3 main.py
