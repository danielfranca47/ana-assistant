@echo off
cd /d C:\ana-assistant\ana-assistant
set ELECTRON_RUN_AS_NODE=
npm run electron:dev > C:\Temp\electron-test.log 2>&1
