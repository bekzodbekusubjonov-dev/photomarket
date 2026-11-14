@echo off
cd /d %~dp0frontend
if not exist node_modules\react-router-dom call npm install
npm run dev
pause
