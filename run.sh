#!/usr/bin/env bash
set -e

echo "[NoticeLens] Setting up virtual environment..."
if [ ! -d ".venv" ]; then
    python3 -m venv .venv
fi

echo "[NoticeLens] Installing requirements..."
source .venv/bin/activate
pip install -r requirements.txt

echo "[NoticeLens] Starting NoticeLens server at http://127.0.0.1:5000 ..."
python app.py
