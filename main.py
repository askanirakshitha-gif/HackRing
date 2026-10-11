"""
MINDMESH-NEXUS Root Entry Point
Re-exports backend.main app for Render / local deployments using 'main:app'
"""
import os
from pathlib import Path
from dotenv import load_dotenv

# Load .env
for p in [Path("backend/.env"), Path(".env"), Path(__file__).resolve().parent / "backend" / ".env"]:
    if p.exists():
        load_dotenv(p, override=True)

from backend.main import app

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)