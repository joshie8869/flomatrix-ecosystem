# ==============================================================
# FloMatrix AI Builder — Main Application (UI + API)
# ==============================================================

from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from .routes import router as job_router
from .config import (
    OPENAI_API_KEY,
    OPENAI_MODEL,
    GITHUB_TOKEN,
    GITHUB_REPO,
    ADMIN_USER,
    AUTO_ALLOWED_PREFIXES,
    PROTECTED_PATH_PREFIXES,
)

# --------------------------------------------------------------
# App
# --------------------------------------------------------------

app = FastAPI(
    title="FloMatrix AI Builder",
    version="1.0.0",
    description="AI microservice responsible for generating & committing code.",
)

# --------------------------------------------------------------
# CORS — safe but simple (mostly redundant now that UI is same origin)
# --------------------------------------------------------------

CORS_ORIGINS = [
    "http://localhost",
    "http://127.0.0.1",
    "http://localhost:9000",
    "http://127.0.0.1:9000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --------------------------------------------------------------
# Mount /ui — serve the AI Builder control panel
# Directory: services/ai-builder/ui/
# --------------------------------------------------------------

BASE_DIR = Path(__file__).resolve().parent          # ...\services\ai-builder\aibuilder
ROOT_DIR = BASE_DIR.parent                          # ...\services\ai-builder
UI_DIR = ROOT_DIR / "ui"                            # ...\services\ai-builder\ui

if UI_DIR.exists():
    app.mount(
        "/ui",
        StaticFiles(directory=str(UI_DIR), html=True),
        name="ui",
    )
    print(f"[AIB][UI] Mounted AI Builder UI at /ui from {UI_DIR}")
else:
    print(f"[AIB][UI] WARNING: UI directory not found at {UI_DIR}")

# --------------------------------------------------------------
# Startup Diagnostics
# --------------------------------------------------------------

@app.on_event("startup")
async def startup_event():
    print("\n===================================================")
    print("     🚀 FloMatrix AI Builder — Startup Report")
    print("===================================================\n")

    print(f"[AIB] OpenAI model: {OPENAI_MODEL}")
    print(f"[AIB] API key loaded: {'YES' if OPENAI_API_KEY else 'NO'}")

    print(f"[AIB] GitHub Repo: {GITHUB_REPO}")
    print(f"[AIB] GitHub Token: {'SET' if GITHUB_TOKEN else 'NOT SET'}")

    print("\n[AIB] Mode C Security")
    print("    → Protected paths:")
    for p in PROTECTED_PATH_PREFIXES:
        print(f"       - {p}")

    print("\n    → Auto-allowed paths:")
    for p in AUTO_ALLOWED_PREFIXES:
        print(f"       - {p}")

    print("\n[AIB] Admin user:", ADMIN_USER)
    print("\n===================================================\n")

# --------------------------------------------------------------
# Routers — all AI Builder API endpoints
# --------------------------------------------------------------

app.include_router(job_router, prefix="/api/ai-builder")
