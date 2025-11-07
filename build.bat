@echo off
REM Adlocaite Broadsign Integration - Build Script (Windows)
REM Creates .x-html-package file for Broadsign Control

echo Building Adlocaite Broadsign Integration Package...
echo.

REM Check if config.js exists
if not exist "package\js\config.js" (
  echo ERROR: config.js not found!
  echo.
  echo Please create config.js from the template:
  echo   copy package\js\config.example.js package\js\config.js
  echo.
  echo Then edit config.js and add your API key.
  exit /b 1
)

REM Check if API key is configured
findstr /C:"pub_xxxx" "package\js\config.js" >nul
if %errorlevel% equ 0 (
  echo WARNING: API key not configured in config.js
  echo Make sure to update your API key before deploying to production.
  echo.
)

REM Clean previous build
if exist "adlocaite-broadsign.x-html-package" (
  echo Cleaning previous build...
  del /F /Q "adlocaite-broadsign.x-html-package"
)

REM Check if 7-Zip is available
where 7z >nul 2>nul
if %errorlevel% neq 0 (
  echo ERROR: 7-Zip not found!
  echo.
  echo Please install 7-Zip from https://www.7-zip.org/
  echo Or use PowerShell to run the package command from package.json
  exit /b 1
)

REM Create package
echo Creating package...
cd package
7z a -tzip ..\adlocaite-broadsign.x-html-package index.html js\*.js css\*.css assets\* -x!.DS_Store
cd ..

REM Check if package was created
if exist "adlocaite-broadsign.x-html-package" (
  echo.
  echo Package created successfully!
  echo.
  echo Package details:
  echo   File: adlocaite-broadsign.x-html-package
  echo.
  echo Next steps:
  echo   1. Open Broadsign Control Administrator
  echo   2. Navigate to Library ^> Ad Copies
  echo   3. Click Upload and select the .x-html-package file
  echo   4. Assign the ad copy to your campaign
  echo.
  echo Testing:
  echo   Enable debug mode in config.js to see detailed logs
  echo   Check Broadsign Player logs for troubleshooting
  echo.
) else (
  echo ERROR: Package creation failed!
  exit /b 1
)


