@echo off
title Jarvis — Arrêt Frontend Next.js
echo.
echo  Arrêt du frontend Next.js (port 3000)...

for /f "tokens=5" %%p in ('netstat -ano ^| findstr ":3000 "') do (
    taskkill /PID %%p /F >nul 2>&1
)

echo  Frontend Next.js arrêté.
