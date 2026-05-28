@echo off
title Jarvis — Arrêt Agent Python
echo.
echo  Arrêt de l'agent Python (uv / python)...

for /f "tokens=5" %%p in ('netstat -ano ^| findstr ":61817"') do (
    taskkill /PID %%p /F >nul 2>&1
)

taskkill /IM uv.exe /F >nul 2>&1
wmic process where "name='python.exe' and commandline like '%%agent.py%%'" delete >nul 2>&1

echo  Agent Python arrêté.
