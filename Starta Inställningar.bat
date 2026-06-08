@echo off
cd /d "%~dp0"
title Microdeb GiftCard - Installningar
echo.
echo  Microdeb GiftCard - Installningar
echo  ====================================
echo.

node start-settings.mjs

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo  Nagot gick fel (kod %ERRORLEVEL%).
    echo  Las felmeddelandet ovan och kontrollera
    echo  de minimerade fonstren i aktivitetsfaltet.
    echo.
    pause
)
