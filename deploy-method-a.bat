@echo off
setlocal enabledelayedexpansion

echo ==============================================================================
echo SolarVision AI — Method A: Docker Compose Deployment
echo ==============================================================================

:: Check if Docker is installed
where docker >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Docker is not found in your PATH!
    echo Please install Docker Desktop for Windows: https://www.docker.com/products/docker-desktop/
    echo Once installed and running, re-run this script.
    pause
    exit /b 1
)

:: Check if docker compose is available
docker compose version >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo [ERROR] 'docker compose' is not available. Please ensure Docker Compose V2 is installed.
    pause
    exit /b 1
)

echo [OK] Docker and Docker Compose detected.

:: Setup .env if missing
if not exist ".env" (
    echo [INFO] .env file not found. Creating from .env.example...
    copy .env.example .env >nul
    echo [NOTICE] A default .env has been created. Ensure JWT_SECRET is set to a secure 32+ character key.
)

:: Build and start containers
echo [INFO] Building and starting SolarVision AI container with Docker Compose...
docker compose up --build -d

if %ERRORLEVEL% neq 0 (
    echo [ERROR] Docker Compose deployment encountered an error!
    echo Check logs with: docker compose logs solarvision
    pause
    exit /b 1
)

echo ==============================================================================
echo [SUCCESS] SolarVision AI is running!
echo ==============================================================================
echo.
docker compose ps
echo.
echo Application URL: http://localhost:3000
echo Check logs:      docker compose logs -f solarvision
echo Stop container:  docker compose down
echo.
pause
