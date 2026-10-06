@echo off
title Project Starter

REM A projekt mappaja = ahol ez a .bat fajl van
set "PROJECT_DIR=%~dp0"

REM XAMPP telepitesi helye
set "XAMPP_DIR=C:\xampp"
echo Projekt inditasa...
echo Apache inditasa...
start "XAMPP Apache" /min cmd /c ""%XAMPP_DIR%\apache_start.bat""
echo MySQL inditasa...
start "XAMPP MySQL" /min cmd /c ""%XAMPP_DIR%\mysql_start.bat""
REM Varunk egy kicsit
timeout /t 2 /nobreak >nul
start "install dependencies" cmd /k "cd /d ""%PROJECT_DIR%"" && install.bat"
echo npm run dev inditasa...
start "DEV Server" cmd /k "cd /d ""%PROJECT_DIR%"" && npm run dev"
echo npm run server inditasa...
start "Backend Server" cmd /k "cd /d ""%PROJECT_DIR%"" && npm run server"
echo Minden szolgaltatas elinditva.
timeout /t 2 /nobreak >nul
exit
