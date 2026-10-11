# MINDMESH-NEXUS Local PowerShell Launcher
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  MINDMESH-NEXUS: Autonomous Voice AI Teacher Co-Pilot" -ForegroundColor Cyan
Write-Host "  Starting Local Full-Stack Environment..." -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host ""

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ScriptDir

# Check Python
try {
    $pyVer = & python --version 2>&1
    Write-Host "[1/3] Python detected: $pyVer" -ForegroundColor Green
} catch {
    Write-Host "[ERROR] Python is not installed or not in PATH!" -ForegroundColor Red
    exit 1
}

# Check Node
try {
    $nodeVer = & node --version 2>&1
    Write-Host "[1/3] Node.js detected: $nodeVer" -ForegroundColor Green
} catch {
    Write-Host "[ERROR] Node.js is not installed or not in PATH!" -ForegroundColor Red
    exit 1
}

# Start Backend in new process
Write-Host "[2/3] Launching FastAPI Backend Brain on http://127.0.0.1:8000..." -ForegroundColor Yellow
Start-Process -FilePath "powershell.exe" -ArgumentList "-NoExit", "-Command", "cd '$ScriptDir'; python main.py"

Start-Sleep -Seconds 2

# Start Frontend in new process
Write-Host "[3/3] Launching Vite Frontend on http://localhost:3000..." -ForegroundColor Yellow
Start-Process -FilePath "powershell.exe" -ArgumentList "-NoExit", "-Command", "cd '$ScriptDir'; npm run dev"

Start-Sleep -Seconds 3

Write-Host ""
Write-Host "================================================================" -ForegroundColor Green
Write-Host "  SUCCESS: MindMesh-Nexus is running locally!" -ForegroundColor Green
Write-Host "  Frontend Dashboard : http://localhost:3000" -ForegroundColor Cyan
Write-Host "  Backend Brain API  : http://127.0.0.1:8000" -ForegroundColor Cyan
Write-Host "  Swagger API Docs   : http://127.0.0.1:8000/docs" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Green
Write-Host ""

Start-Process "http://localhost:3000"
