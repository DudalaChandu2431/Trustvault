@echo off
echo Starting TrustVault Enterprise...
cd /d "%~dp0backend"
if not exist test_env (
    python -m venv test_env
)
start "TrustVault Backend (FastAPI)" cmd /k "cd /d %~dp0backend && test_env\Scripts\python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload"
start "TrustVault Frontend (Vite)" cmd /k "cd /d %~dp0frontend && npm run dev -- --host 127.0.0.1 --port 5173"
echo TrustVault Backend: http://127.0.0.1:8000
echo TrustVault Frontend: http://127.0.0.1:5173
