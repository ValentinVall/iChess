@echo off
REM iChess Docker Setup Script for Windows

echo.
echo 🐳 iChess Docker Setup
echo ====================
echo.

REM Check if Docker is installed
docker --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Docker is not installed. Please install Docker Desktop.
    echo    https://www.docker.com/products/docker-desktop
    pause
    exit /b 1
)

echo ✓ Docker is installed
echo   Version: 
docker --version

echo.

REM Setup environment file
if exist ".env" (
    echo ✓ .env file already exists
) else (
    copy .env.docker .env
    echo ✓ Created .env file from .env.docker
    echo   Please update Apple Sign In keys in .env
)

echo.
echo Building Docker images...
docker-compose build

echo.
echo Starting services...
docker-compose up -d

echo.
echo Waiting for database...
timeout /t 5

echo.
echo Running database migrations...
docker-compose exec -T backend npm run db:migrate

echo.
echo ✅ Setup complete!
echo.
echo Services running:
echo   Frontend: http://localhost:5173
echo   Backend:  http://localhost:3000/api
echo   Database: localhost:5432
echo.
echo View logs: docker-compose logs -f
echo Stop: docker-compose down
echo.
pause
