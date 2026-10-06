@echo off
ECHO installing dependencies...
CMD /C  "cd /d "%~dp0" && npm install"
pause
ECHO installing dependencies completed.
exit
