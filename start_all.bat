@echo off
echo =========================================
echo  AI-Powered Smart Agriculture - Launcher
echo =========================================
echo.
echo [1/2] Starting Backend (FastAPI)...
Start "Smart Agri - Backend" powershell -NoExit -Command "cd '%~dp0backend'; $env:TF_ENABLE_ONEDNN_OPTS=0; python main.py"

echo Waiting for backend to load models...
timeout /t 5 /nobreak > nul

echo [2/2] Starting Frontend (React/Vite)...
Start "Smart Agri - Frontend" powershell -NoExit -Command "cd '%~dp0frontend'; npm run dev"

echo.
echo =========================================
echo  Both servers starting in new windows!
echo  Backend  : http://localhost:8000
echo  Frontend : http://localhost:5173
echo  API Docs : http://localhost:8000/docs
echo =========================================
timeout /t 3 /nobreak > nul
start "" "http://localhost:5173"
