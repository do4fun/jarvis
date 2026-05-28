@echo off
title Jarvis — Arrêt complet
echo.
echo  ██████╗  Jarvis — Arrêt complet
echo  ██╔══██╗ ━━━━━━━━━━━━━━━━━━━━━━
echo  ███████║ Agent Python  →  arrêté
echo  ██╔══██╝ Frontend Next →  arrêté
echo  ██║  ██║
echo  ╚═╝  ╚═╝
echo.

call "%~dp0stop-agent.bat"
call "%~dp0stop-frontend.bat"

echo.
echo  Tous les services sont arrêtés.
echo.
pause
