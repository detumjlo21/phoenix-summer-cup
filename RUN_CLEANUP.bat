@echo off
chcp 65001 >nul
title Phoenix V40 Cleanup
echo.
echo PHOENIX V40 - DON DEP REPO
echo.
echo 1. Xem truoc (khong thay doi file)
echo 2. Thuc hien don dep
echo 3. Thoat
echo.
set /p choice=Chon: 

if "%choice%"=="1" (
  powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0cleanup_v40.ps1" -DryRun
  pause
  exit /b
)

if "%choice%"=="2" (
  powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0cleanup_v40.ps1"
  pause
  exit /b
)

exit /b
