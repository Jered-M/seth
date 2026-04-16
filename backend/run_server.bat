@echo off
echo =================================================
echo    Lancement du serveur backend SetH
echo =================================================
echo.

cd /d "%~dp0"

echo [1/2] Activation de l'environnement virtuel...
call ..\.venv\Scripts\activate.bat

echo [2/2] Demarrage du serveur Flask...
echo.
python run.py

pause
