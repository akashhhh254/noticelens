@echo off
setlocal

echo [NoticeLens] Setting up virtual environment...
if not exist ".venv" (
    python -m venv .venv
)

echo [NoticeLens] Installing requirements...
call .venv\Scripts\activate.bat
python -m pip install -r requirements.txt

echo [NoticeLens] Starting NoticeLens server at http://127.0.0.1:5000 ...
python app.py
