@echo off
rem TrustVote: corre o stack.ps1 sem depender da politica de execucao do PowerShell.
rem   stack.cmd up      arranca tudo (na 1.a vez cria o .env e os dados de demonstracao)
rem   stack.cmd down    para tudo (mantem os dados)
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0stack.ps1" %*
exit /b %ERRORLEVEL%
