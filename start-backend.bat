@echo off
cd /d %~dp0backend
if not exist .venv (
  echo Python muhit yaratilmoqda...
  python -m venv .venv
  call .venv\Scripts\activate.bat
  pip install -r requirements.txt
) else (
  call .venv\Scripts\activate.bat
)
if not exist .env copy .env.example .env
if not exist uploads\site\manifest.json (
  echo Sayt rasmlari yuklab olinmoqda (bir marta)...
  python -m app.cli fetch-images
)
uvicorn app.main:app --reload --port 8000
pause
