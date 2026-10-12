@echo off
title Smart Agriculture AI Launcher
echo =========================================
echo  AI-Powered Smart Agriculture - Launcher
echo =========================================
echo.

echo [1/2] Starting Backend (FastAPI + TFLite Models)...
start "Smart Agri BACKEND" cmd /k "cd /d "%~dp0backend" && set TF_ENABLE_ONEDNN_OPTS=0 && python main.py"

echo Waiting for backend to load all 4 AI models...
echo (This takes 20-30 seconds on first run)
echo.

:: Wait and check if backend is up (poll every 5s, max 60s)
set /a tries=0
:WAIT_BACKEND
timeout /t 5 /nobreak > nul
set /a tries+=1
powershell -Command "try { $r=(Invoke-WebRequest -Uri 'http://localhost:8000/health' -UseBasicParsing -TimeoutSec 2).StatusCode; if($r -eq 200){exit 0}else{exit 1} } catch { exit 1 }" >nul 2>&1
if %errorlevel%==0 goto BACKEND_READY
if %tries% geq 12 goto BACKEND_TIMEOUT
echo   Still loading... (%tries%/12)
goto WAIT_BACKEND

:BACKEND_READY
echo   Backend is READY! (http://localhost:8000)
echo.
echo [2/2] Starting Frontend (Vite)...
start "Smart Agri FRONTEND" cmd /k "cd /d "%~dp0frontend" && npm run dev"

echo Waiting for Vite to compile...
timeout /t 12 /nobreak > nul

echo.
echo =========================================
echo  READY! Opening browser now...
echo  Frontend : http://localhost:5173
echo  API Docs : http://localhost:8000/docs
echo =========================================
start "" "http://localhost:5173"
goto END

:BACKEND_TIMEOUT
echo.
echo WARNING: Backend took too long to start.
echo Check the backend window for errors.
echo Trying to open frontend anyway...
start "Smart Agri FRONTEND" cmd /k "cd /d "%~dp0frontend" && npm run dev"
timeout /t 12 /nobreak > nul
start "" "http://localhost:5173"

:END
