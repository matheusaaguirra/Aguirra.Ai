@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Instale o Node.js 24 pelo site https://nodejs.org e abra este arquivo novamente.
  pause
  exit /b 1
)
where ollama >nul 2>nul
if errorlevel 1 (
  echo Instale o Ollama pelo site https://ollama.com/download e abra este arquivo novamente.
  pause
  exit /b 1
)
if not exist node_modules (
  call npm ci
  if errorlevel 1 exit /b 1
)
ollama list >nul 2>nul
if errorlevel 1 (
  start "Ollama local" /min ollama serve
  timeout /t 3 /nobreak >nul
)
ollama show qwen3:4b >nul 2>nul
if errorlevel 1 (
  echo Baixando o modelo local gratuito. O download inicial tem aproximadamente 2,5 GB.
  ollama pull qwen3:4b
  if errorlevel 1 (
    echo Nao foi possivel baixar o modelo. Confira a conexao.
    pause
    exit /b 1
  )
)
ollama create aguirra-local -f Modelfile
if errorlevel 1 exit /b 1
call npm run local
pause
