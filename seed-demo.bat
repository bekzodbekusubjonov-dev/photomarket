@echo off
cd /d %~dp0backend
call .venv\Scripts\activate.bat
python -m app.cli seed-demo
pause
