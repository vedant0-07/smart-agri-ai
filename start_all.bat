@echo off
echo =========================================
echo  AI-Powered Smart Agriculture - Launcher
echo =========================================
echo.

echo [1/2] Starting Backend (FastAPI)...
start "Smart Agri - Backend" cmd /k "cd /d "%~dp0backend" && python main.py"

echo Waiting for backend to start (15s)...
timeout /t 15 /nobreak > nul

echo [2/2] Starting Frontend (Vite)...
start "Smart Agri - Frontend" cmd /k "cd /d "%~dp0frontend" && npm run dev"

echo.
echo Waiting for Vite to compile (15s)...
timeout /t 15 /nobreak > nul

echo.
echo =========================================
echo  Servers starting - check windows above!
echo  Backend  : http://localhost:8000
echo  Frontend : http://localhost:5173
echo  API Docs : http://localhost:8000/docs
echo =========================================
echo.
echo Opening browser in 5 seconds...
timeout /t 5 /nobreak > nul

start "" "http://localhost:5173"
