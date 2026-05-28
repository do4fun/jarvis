@echo off
title Jarvis — Launcher
echo.
echo  ██████╗  Jarvis — Démarrage complet
echo  ██╔══██╗ ━━━━━━━━━━━━━━━━━━━━━━━━━━
echo  ███████║ Agent Python  →  fenêtre 1
echo  ██╔══██╝ Frontend Next →  fenêtre 2
echo  ██║  ██║
echo  ╚═╝  ╚═╝
echo.

start "Jarvis — Agent Python"   cmd /k "%~dp0start-agent.bat"
timeout /t 3 /nobreak >nul
start "Jarvis — Frontend Next"  cmd /k "%~dp0start-frontend.bat"

echo  Les deux serveurs ont démarré dans de nouvelles fenêtres.
echo  Frontend : http://localhost:3000
echo.
pause
