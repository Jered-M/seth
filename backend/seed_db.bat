@echo off
echo =================================================
echo    Seeding de la base de donnees SetH
echo =================================================
echo.

cd /d "%~dp0"

echo [1/2] Activation de l'environnement virtuel...
call ..\.venv\Scripts\activate.bat

echo [2/2] Execution du seed...
echo.
python seed.py

pause
