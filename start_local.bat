@echo off
echo ===================================================
echo     FUGEN SMARTPAY: FULL SYSTEM STARTUP
echo ===================================================
echo.
echo 1. Starting Backend Server...
start cmd /k "cd backend && npm install && npm run dev"
echo.
echo 2. Waiting for Backend to initialize...
timeout /t 5
echo.
echo 3. Starting Admin Dashboard (Frontend)...
cd frontend
npm install
npm run dev
pause
