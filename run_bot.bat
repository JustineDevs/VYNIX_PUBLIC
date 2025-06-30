@echo off
REM First Published by JustineDevs

REM Batch file to run the Testnet Automation Bot in a new terminal window and keep it open
cd /d "%~dp0"

REM Optional: Activate Node.js environment if needed
REM call "C:\path\to\your\nodejs\setup.bat"

REM Run the bot in a new window and keep the window open after execution
start "Testnet Automation Bot" cmd /k "node dist/automate.js"

pause 