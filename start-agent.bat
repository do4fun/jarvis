@echo off
title Jarvis — Agent Python
set PATH=%USERPROFILE%\.local\bin;%PATH%
cd /d "%~dp0backend"
echo.
echo  ██ Jarvis Agent — LiveKit + Claude + Cartesia
echo  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo.
uv run agent.py dev
pause
