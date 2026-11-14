@echo off
cd /d %~dp0backend
if not exist .venv (
  python -m venv .venv
  call .venv\Scripts\activate.bat
  pip install -r requirements.txt
) else (
  call .venv\Scripts\activate.bat
)
if not exist .env copy .env.example .env
python -m app.cli setup-script
pause
