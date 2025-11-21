@echo off
echo ========================================
echo AskQL - Setup Environment Files
echo ========================================
echo.

REM Get the script directory
set SCRIPT_DIR=%~dp0
echo Script directory: %SCRIPT_DIR%
echo.

REM ===== Backend .env =====
echo [1/2] Setting up Backend .env file...
if exist "%SCRIPT_DIR%backend\.env" (
    echo       Removing old backend\.env...
    del "%SCRIPT_DIR%backend\.env"
)

if exist "%SCRIPT_DIR%backend\.env.example" (
    copy "%SCRIPT_DIR%backend\.env.example" "%SCRIPT_DIR%backend\.env" >nul
    if errorlevel 1 (
        echo       ERROR: Failed to copy backend\.env.example
    ) else (
        echo       SUCCESS: backend\.env created!
    )
) else (
    echo       ERROR: backend\.env.example not found!
)
echo.

REM ===== Frontend .env =====
echo [2/2] Setting up Frontend .env file...
if exist "%SCRIPT_DIR%askql-app\.env" (
    echo       Removing old askql-app\.env...
    del "%SCRIPT_DIR%askql-app\.env"
)

if exist "%SCRIPT_DIR%askql-app\.env.example" (
    copy "%SCRIPT_DIR%askql-app\.env.example" "%SCRIPT_DIR%askql-app\.env" >nul
    if errorlevel 1 (
        echo       ERROR: Failed to copy askql-app\.env.example
    ) else (
        echo       SUCCESS: askql-app\.env created!
    )
) else (
    echo       WARNING: askql-app\.env.example not found, skipping...
)
echo.

echo ========================================
echo Setup Complete!
echo ========================================
echo.
echo IMPORTANT: Edit backend\.env and add your Gemini API key!
echo.
pause
