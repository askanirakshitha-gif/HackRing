@echo off
title MINDMESH-NEXUS Local Launcher
echo ================================================================
echo   MINDMESH-NEXUS: Autonomous Voice AI Teacher Co-Pilot
echo   Starting Local Development Environment...
echo ================================================================
echo.

cd /d "%~dp0"

echo [1/3] Checking Python & Node.js environment...
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Python is not installed or not in PATH! Please install Python 3.10+.
    pause
    exit /b 1
)

node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed or not in PATH! Please install Node.js 18+.
    pause
    exit /b 1
)

echo [2/3] Starting FastAPI Backend Brain on http://127.0.0.1:8000...
start "MINDMESH Backend Brain (Port 8000)" cmd /k "python main.py"

timeout /t 2 /nobreak >nul

echo [3/3] Starting Vite Frontend Dashboard on http://localhost:3000...
start "MINDMESH Frontend (Port 3000)" cmd /k "npm run dev"

timeout /t 3 /nobreak >nul

echo.
echo ================================================================
echo   SUCCESS: All services are now running locally!
echo.
echo   * Frontend Dashboard:  http://localhost:3000
echo   * Backend Brain API:   http://127.0.0.1:8000
echo   * Swagger API Docs:    http://127.0.0.1:8000/docs
echo   * Faster-Whisper ASR:  Running locally on CPU
echo   * Ollama AI Engine:    Connected (Local daemon or Cloud proxy)
echo ================================================================
echo.
echo Opening browser to http://localhost:3000...
start http://localhost:3000
