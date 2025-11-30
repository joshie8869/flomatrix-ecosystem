# ==============================================================
# FloMatrix AI Builder — Main Application
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
# Core FastAPI app
# --------------------------------------------------------------
app = FastAPI(
    title="FloMatrix AI Builder",
    version="1.0.0",
    description="AI microservice responsible for generating & committing code.",
)

# --------------------------------------------------------------
# CORS (still enabled, but once UI is same-origin it is mostly moot)
# --------------------------------------------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   # safe for local dev; tighten later if needed
    allow_methods=["*"],
    allow_headers=["*"],
)

# --------------------------------------------------------------
# Mount the UI at /ui so browser origin is http://localhost:9000
# --------------------------------------------------------------
BASE_DIR = Path(__file__).resolve().parent          # .../ai-builder/aibuilder
PROJECT_ROOT = BASE_DIR.parent                      # .../ai-builder
UI_DIR = PROJECT_ROOT / "ui"                        # .../ai-builder/ui

if UI_DIR.exists():
    print(f"[AIB][UI] Mounting AI Builder UI from: {UI_DIR}")
    app.mount(
        "/ui",
        StaticFiles(directory=str(UI_DIR), html=True),
        name="ui",
    )
else:
    print(f"[AIB][UI] WARNING: UI directory not found at {UI_DIR}")

# --------------------------------------------------------------
# Startup Diagnostics (Very Important!)
# --------------------------------------------------------------
@app.on_event("startup")
async def startup_event() -> None:
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
# Routers
# --------------------------------------------------------------
app.include_router(job_router, prefix="/api/ai-builder")
