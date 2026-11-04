@echo off
setlocal
title LNCR Multi-Body STEP Splitter
color 0B

echo ======================================================================
echo    LATE NIGHT COMBAT ROBOTICS - MULTI-BODY STEP DECOMPOSER
echo ======================================================================
echo.
echo [1/3] Checking Python 3.11+ environment...
python --version >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Python is not installed or not in your system PATH.
    echo Please install Python 3.11 or newer from https://python.org
    pause
    exit /b 1
)

echo [2/3] Checking dependencies (FastAPI, Uvicorn, Gmsh OpenCASCADE)...
python -c "import fastapi, uvicorn, gmsh" >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [INFO] Installing required CAD and web packages...
    python -m pip install fastapi uvicorn python-multipart
)

echo [3/3] Starting LNCR STEP Splitter web application...
echo.
echo ======================================================================
echo  Open your browser at: http://localhost:8080
echo  Press Ctrl+C in this terminal window to stop the server.
echo ======================================================================
echo.

start "" "http://localhost:8080"
python app.py

pause
