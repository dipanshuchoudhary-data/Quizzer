@echo off
cd C:\dev\Quizzer
npm run lint:frontend
if errorlevel 1 (
  echo Lint failed with error code %errorlevel%
  exit /b 1
) else (
  echo Lint passed
  exit /b 0
)
