@echo off
setlocal EnableDelayedExpansion
cls
color 07
title AskQL Application Launcher

:main_menu
cls
call logo.bat

REM Check what's installed
set BACKEND_EXISTS=0
set FRONTEND_EXISTS=0
set BACKEND_ENV_EXISTS=0
set FRONTEND_ENV_EXISTS=0

echo Checking setup status...
if exist backend\venv (
    echo - Backend virtual environment: OK
    set BACKEND_EXISTS=1
) else (
    echo - Backend virtual environment: NOT FOUND
)

if exist askql-app\node_modules (
    echo - Frontend dependencies: OK
    set FRONTEND_EXISTS=1
) else (
    echo - Frontend dependencies: NOT FOUND
)

if exist backend\.env (
    echo - Backend .env file: OK
    set BACKEND_ENV_EXISTS=1
) else (
    echo - Backend .env file: NOT FOUND
)

if exist askql-app\.env (
    echo - Frontend .env file: OK
    set FRONTEND_ENV_EXISTS=1
) else (
    echo - Frontend .env file: NOT FOUND
)

echo ^|-----------------------------------^|------------------------------^|
echo ^| [1] Run both frontend and backend ^| [6] Reinstall .env file      ^|
echo ^| [2] Run backend only              ^| [7] Reinstall everything     ^|
echo ^| [3] Run frontend only             ^| [8] Check setup status again ^|
echo ^| [4] Reinstall backend             ^| [9] Exit                     ^|
echo ^| [5] Reinstall frontend            ^|                              ^|
echo ^|-----------------------------------^|------------------------------^|
echo.
choice /c 123456789 /n /m "Enter your choice (1-9): "

if errorlevel 9 goto exit_script
if errorlevel 8 goto main_menu
if errorlevel 7 goto reinstall_all
if errorlevel 6 goto reinstall_env
if errorlevel 5 goto reinstall_frontend
if errorlevel 4 goto reinstall_backend
if errorlevel 3 goto run_frontend_only
if errorlevel 2 goto run_backend_only
if errorlevel 1 goto run_application
goto main_menu

REM ========================================
REM Reinstall All
REM ========================================
:reinstall_all
start "Reinstall Backend - AskQL" cmd /k "cd /d %~dp0 && (echo ======================================== && echo Reinstalling Backend && echo ======================================== && echo. && echo [Backend] Checking Python installation... && python --version && echo. && (if exist backend\venv (echo [Backend] Removing old virtual environment... && rmdir /s /q backend\venv && echo [Backend] Old venv removed.)) && echo [Backend] Creating Python virtual environment... && cd backend && python -m venv venv && echo [Backend] Installing Python dependencies... && call venv\Scripts\activate.bat && pip install -r requirements.txt && cd .. && echo. && echo ======================================== && echo Backend reinstalled successfully! && echo ========================================) && echo. && pause && exit"
start "Reinstall Frontend - AskQL" cmd /k "cd /d %~dp0 && (echo ======================================== && echo Reinstalling Frontend && echo ======================================== && echo. && echo [Frontend] Checking Node.js installation... && node --version && echo. && (if exist askql-app\node_modules (echo [Frontend] Removing old node_modules... && rmdir /s /q askql-app\node_modules && echo [Frontend] Old node_modules removed.)) && echo [Frontend] Installing Node.js dependencies... && cd askql-app && call npm install && cd .. && echo. && echo ======================================== && echo Frontend reinstalled successfully! && echo ========================================) && echo. && pause && exit"
start "Reinstall .env - AskQL" cmd /k "cd /d "%~dp0" && call setup-env.bat && exit"
goto main_menu

REM ========================================
REM Reinstall Backend
REM ========================================
:reinstall_backend
start "Reinstall Backend - AskQL" cmd /k "cd /d %~dp0 && (echo ======================================== && echo Reinstalling Backend && echo ======================================== && echo. && echo [Backend] Checking Python installation... && python --version && echo. && (if exist backend\venv (echo [Backend] Removing old virtual environment... && rmdir /s /q backend\venv && echo [Backend] Old venv removed.)) && echo [Backend] Creating Python virtual environment... && cd backend && python -m venv venv && echo [Backend] Installing Python dependencies... && call venv\Scripts\activate.bat && pip install -r requirements.txt && cd .. && echo. && echo ======================================== && echo Backend reinstalled successfully! && echo ========================================) && echo. && pause && exit"
goto main_menu

REM ========================================
REM Reinstall Frontend
REM ========================================
:reinstall_frontend
start "Reinstall Frontend - AskQL" cmd /k "cd /d %~dp0 && (echo ======================================== && echo Reinstalling Frontend && echo ======================================== && echo. && echo [Frontend] Checking Node.js installation... && node --version && echo. && (if exist askql-app\node_modules (echo [Frontend] Removing old node_modules... && rmdir /s /q askql-app\node_modules && echo [Frontend] Old node_modules removed.)) && echo [Frontend] Installing Node.js dependencies... && cd askql-app && call npm install && cd .. && echo. && echo ======================================== && echo Frontend reinstalled successfully! && echo ========================================) && echo. && pause && exit"
goto main_menu

REM ========================================
REM Reinstall .env
REM ========================================
:reinstall_env
start "Reinstall .env - AskQL" cmd /k "cd /d "%~dp0" && call setup-env.bat"
goto main_menu

REM ========================================
REM Setup Backend Function
REM ========================================
:setup_backend
echo [Backend] Checking Python installation...
python --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Python is not installed or not in PATH
    echo Please install Python 3.8+ from https://www.python.org/
    pause
    exit /b 1
)
echo [Backend] Python found!
echo.

if exist backend\venv (
    echo [Backend] Removing old virtual environment...
    rmdir /s /q backend\venv
)

echo [Backend] Creating Python virtual environment...
cd backend
python -m venv venv
if errorlevel 1 (
    echo ERROR: Failed to create virtual environment
    cd ..
    pause
    exit /b 1
)

echo [Backend] Installing Python dependencies...
call venv\Scripts\activate.bat
pip install -r requirements.txt
if errorlevel 1 (
    echo ERROR: Failed to install Python dependencies
    cd ..
    pause
    exit /b 1
)

cd ..
echo [Backend] Setup complete!
exit /b 0

REM ========================================
REM Setup Frontend Function
REM ========================================
:setup_frontend
echo [Frontend] Checking Node.js installation...
node --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Node.js is not installed or not in PATH
    echo Please install Node.js 18+ from https://nodejs.org/
    pause
    exit /b 1
)
echo [Frontend] Node.js found!
echo.

if exist askql-app\node_modules (
    echo [Frontend] Removing old node_modules...
    rmdir /s /q askql-app\node_modules
)

echo [Frontend] Installing Node.js dependencies...
cd askql-app
call npm install --silent
if errorlevel 1 (
    echo ERROR: Failed to install Node.js dependencies
    cd ..
    pause
    exit /b 1
)

cd ..
echo [Frontend] Setup complete!
exit /b 0

REM ========================================
REM Setup .env Function
REM ========================================
:setup_env
if exist backend\.env (
    echo [.env] Removing old .env file...
    del backend\.env
)

echo [.env] Creating .env file from template...
cd backend
if not exist .env.example (
    echo ERROR: .env.example not found in backend folder
    cd ..
    pause
    exit /b 1
)
copy .env.example .env >nul
cd ..
echo [.env] Setup complete!
exit /b 0

REM ========================================
REM Run Application (Both Servers)
REM ========================================
:run_application
REM Check if setup is needed
if not exist backend\venv (
    cls
    echo ========================================
    echo Backend not set up. Installing...
    echo ========================================
    echo.
    echo Opening new terminal window to install backend...
    echo.
    start "Setup Backend - AskQL" cmd /c "cd /d %~dp0 && (echo ======================================== && echo Installing Backend && echo ======================================== && echo. && echo [Backend] Checking Python installation... && python --version && echo. && echo [Backend] Creating Python virtual environment... && cd backend && python -m venv venv && echo [Backend] Virtual environment created. && echo. && echo [Backend] Installing Python dependencies... && call venv\Scripts\activate.bat && pip install -r requirements.txt && cd .. && echo. && echo ======================================== && echo Backend installed successfully! && echo ========================================) && echo. && pause"
    echo.
    echo Waiting for backend installation to complete...
    echo Check the new terminal window for progress.
    echo.
    pause
    goto main_menu
)

if not exist askql-app\node_modules (
    cls
    echo ========================================
    echo Frontend not set up. Installing...
    echo ========================================
    echo.
    echo Opening new terminal window to install frontend...
    echo.
    start "Setup Frontend - AskQL" cmd /c "cd /d %~dp0 && (echo ======================================== && echo Installing Frontend && echo ======================================== && echo. && echo [Frontend] Checking Node.js installation... && node --version && echo. && echo [Frontend] Installing Node.js dependencies (this may take a few minutes)... && cd askql-app && call npm install && cd .. && echo. && echo ======================================== && echo Frontend installed successfully! && echo ========================================) && echo. && pause"
    echo.
    echo Waiting for frontend installation to complete...
    echo Check the new terminal window for progress.
    echo.
    pause
    goto main_menu
)

if not exist backend\.env (
    cls
    echo ========================================
    echo Backend .env file not found. Creating...
    echo ========================================
    echo.
    echo Opening new terminal window to create .env files...
    echo.
    start "Setup .env - AskQL" cmd /c "cd /d %~dp0 && (echo ======================================== && echo Creating .env Files && echo ======================================== && echo. && echo [Backend .env] Creating from template... && cd backend && copy .env.example .env && cd .. && echo [Backend .env] Complete! && echo. && echo [Frontend .env] Creating from template... && cd askql-app && (if exist .env.example (copy .env.example .env && echo [Frontend .env] Complete!) else (echo [Frontend .env] No template found, skipping.)) && cd .. && echo. && echo ======================================== && echo .env files created successfully! && echo ======================================== && echo. && echo IMPORTANT: Edit backend\.env and add your Gemini API key!) && echo. && pause"
    echo.
    echo IMPORTANT: Edit backend\.env and add your Gemini API key before starting!
    echo.
    pause
    goto main_menu
)

if not exist askql-app\.env (
    cls
    echo ========================================
    echo Frontend .env file not found. Creating...
    echo ========================================
    echo.
    echo Opening new terminal window to create .env files...
    echo.
    start "Setup .env - AskQL" cmd /c "cd /d %~dp0 && (echo ======================================== && echo Creating .env Files && echo ======================================== && echo. && echo [Backend .env] Creating from template... && cd backend && (if not exist .env (copy .env.example .env && echo [Backend .env] Complete!) else (echo [Backend .env] Already exists.)) && cd .. && echo. && echo [Frontend .env] Creating from template... && cd askql-app && (if exist .env.example (copy .env.example .env && echo [Frontend .env] Complete!) else (echo [Frontend .env] No template found, skipping.)) && cd .. && echo. && echo ======================================== && echo .env files created successfully! && echo ========================================) && echo. && pause"
    echo.
    pause
    goto main_menu
)

start "AskQL Backend" cmd /k "cd /d %~dp0backend && call venv\Scripts\activate.bat && uvicorn app.main:app --reload --host 0.0.0.0 --port 8000"
start "AskQL Frontend" cmd /k "cd /d %~dp0askql-app && npm run dev"
goto main_menu

REM ========================================
REM Run Backend Only
REM ========================================
:run_backend_only
REM Check if setup is needed
if not exist backend\venv (
    cls
    echo ========================================
    echo Backend not set up. Installing...
    echo ========================================
    echo.
    echo Opening new terminal window to install backend...
    echo.
    start "Setup Backend - AskQL" cmd /c "cd /d %~dp0 && (echo ======================================== && echo Installing Backend && echo ======================================== && echo. && echo [Backend] Checking Python installation... && python --version && echo. && echo [Backend] Creating Python virtual environment... && cd backend && python -m venv venv && echo [Backend] Virtual environment created. && echo. && echo [Backend] Installing Python dependencies... && call venv\Scripts\activate.bat && pip install -r requirements.txt && cd .. && echo. && echo ======================================== && echo Backend installed successfully! && echo ========================================) && echo. && pause"
    echo.
    echo Waiting for backend installation to complete...
    echo Check the new terminal window for progress.
    echo.
    pause
    goto main_menu
)

if not exist backend\.env (
    cls
    echo ========================================
    echo Backend .env file not found. Creating...
    echo ========================================
    echo.
    echo Opening new terminal window to create .env files...
    echo.
    start "Setup .env - AskQL" cmd /c "cd /d %~dp0 && (echo ======================================== && echo Creating .env Files && echo ======================================== && echo. && echo [Backend .env] Creating from template... && cd backend && copy .env.example .env && cd .. && echo [Backend .env] Complete! && echo. && echo [Frontend .env] Creating from template... && cd askql-app && (if exist .env.example (copy .env.example .env && echo [Frontend .env] Complete!) else (echo [Frontend .env] No template found, skipping.)) && cd .. && echo. && echo ======================================== && echo .env files created successfully! && echo ======================================== && echo. && echo IMPORTANT: Edit backend\.env and add your Gemini API key!) && echo. && pause"
    echo.
    echo IMPORTANT: Edit backend\.env and add your Gemini API key before starting!
    echo.
    pause
    goto main_menu
)

start "AskQL Backend" cmd /k "cd /d %~dp0backend && call venv\Scripts\activate.bat && uvicorn app.main:app --reload --host 0.0.0.0 --port 8000"
goto main_menu

REM ========================================
REM Run Frontend Only
REM ========================================
:run_frontend_only
REM Check if setup is needed
if not exist askql-app\node_modules (
    cls
    echo ========================================
    echo Frontend not set up. Installing...
    echo ========================================
    echo.
    echo Opening new terminal window to install frontend...
    echo.
    start "Setup Frontend - AskQL" cmd /c "cd /d %~dp0 && (echo ======================================== && echo Installing Frontend && echo ======================================== && echo. && echo [Frontend] Checking Node.js installation... && node --version && echo. && echo [Frontend] Installing Node.js dependencies (this may take a few minutes)... && cd askql-app && call npm install && cd .. && echo. && echo ======================================== && echo Frontend installed successfully! && echo ========================================) && echo. && pause"
    echo.
    echo Waiting for frontend installation to complete...
    echo Check the new terminal window for progress.
    echo.
    pause
    goto main_menu
)

start "AskQL Frontend" cmd /k "cd /d %~dp0askql-app && npm run dev"
goto main_menu

REM ========================================
REM Exit
REM ========================================
:exit_script
cls
echo.
echo Thank you for using AskQL!
echo.
timeout /t 2 /nobreak >nul
exit /b 0
