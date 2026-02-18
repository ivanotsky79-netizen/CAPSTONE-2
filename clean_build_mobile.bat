@echo off
echo Cleaning build environment...

:: Kill any lingering node processes (optional but recommended)
taskkill /F /IM node.exe /T 2>nul
echo Node processes stopped.

cd mobile-app
if %errorlevel% neq 0 (
    echo Error: specific folder not found.
    pause
    exit /b
)

echo Deleting lockfile and request node_modules...
del package-lock.json 2>nul
rmdir /s /q node_modules 2>nul

echo Installing dependencies (SDK 52)...
call npm install
if %errorlevel% neq 0 (
    echo Error: npm install failed.
    pause
    exit /b
)

echo Build ready. 
echo run: set EAS_NO_VCS=1 && eas build -p android --profile preview
pause
