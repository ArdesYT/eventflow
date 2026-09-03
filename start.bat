@echo off
title Project Starter

REM ==============================
REM Beallitasok
REM ==============================

REM A projekt mappaja = ahol ez a .bat fajl van
set "PROJECT_DIR=%~dp0"

REM XAMPP telepitesi helye
set "XAMPP_DIR=C:\xampp"


echo ========================================
echo Projekt inditasa...
echo ========================================


REM ==============================
REM XAMPP - Apache
REM ==============================

echo Apache inditasa...
start "XAMPP Apache" /min cmd /c ""%XAMPP_DIR%\apache_start.bat""


REM ==============================
REM XAMPP - MySQL
REM ==============================

echo MySQL inditasa...
start "XAMPP MySQL" /min cmd /c ""%XAMPP_DIR%\mysql_start.bat""


REM Varunk egy kicsit
timeout /t 2 /nobreak >nul


REM ==============================
REM npm run dev
REM ==============================

echo npm run dev inditasa...
start "DEV Server" cmd /k "cd /d ""%PROJECT_DIR%"" && npm run dev"


REM ==============================
REM npm run server
REM ==============================

echo npm run server inditasa...
start "Backend Server" cmd /k "cd /d ""%PROJECT_DIR%"" && npm run server"


echo.
echo ========================================
echo Minden szolgaltatas elinditva.
echo ========================================

timeout /t 2 /nobreak >nul
exit