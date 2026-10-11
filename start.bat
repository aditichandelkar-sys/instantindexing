@echo off
title Index Metrix Server
echo ====================================================
echo Starting Index Metrix Server...
echo ====================================================
cd /d "%~dp0"
npm run dev
pause
