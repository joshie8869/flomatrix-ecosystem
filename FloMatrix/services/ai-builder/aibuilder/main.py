# ==============================================================
# FloMatrix AI Builder — Main Application (UI + API)
# ==============================================================

from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse
from .ai_commands import router as ai_commands_router

from .routes import router as job_router
from .ai_commands import router as ai_commands_router
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
# CORS — wide open for local dev
# --------------------------------------------------------------

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --------------------------------------------------------------
# UI paths
#   ROOT_DIR:   .../services/ai-builder
#   UI_DIR:     .../services/ai-builder/ui
#   assets dir: .../services/ai-builder/ui/assets
# --------------------------------------------------------------

BASE_DIR = Path(__file__).resolve().parent          # .../aibuilder
ROOT_DIR = BASE_DIR.parent                          # .../services/ai-builder
UI_DIR = (ROOT_DIR / "ui").resolve()
ASSETS_DIR = UI_DIR / "assets"

print(f"[AIB][PATH] BASE_DIR   = {BASE_DIR}")
print(f"[AIB][PATH] ROOT_DIR   = {ROOT_DIR}")
print(f"[AIB][PATH] UI_DIR     = {UI_DIR} (exists={UI_DIR.exists()})")
print(f"[AIB][PATH] ASSETS_DIR = {ASSETS_DIR} (exists={ASSETS_DIR.exists()})")

# --------------------------------------------------------------
# Explicit /ui route → always return index.html
# --------------------------------------------------------------

@app.get("/ui", response_class=HTMLResponse)
@app.get("/ui/", response_class=HTMLResponse)
async def serve_ui():
    index_path = UI_DIR / "index.html"
    if not index_path.exists():
        return HTMLResponse(
            content=f"<h1>index.html not found</h1><p>Looked in: {index_path}</p>",
            status_code=500,
        )
    return index_path.read_text(encoding="utf-8")

# --------------------------------------------------------------
# Static assets under /assets/...  (matches paths like "assets/css/ui.css")
# --------------------------------------------------------------

if ASSETS_DIR.exists():
    app.mount(
        "/assets",
        StaticFiles(directory=str(ASSETS_DIR)),
        name="assets",
    )
    print(f"[AIB][UI] Mounted assets at /assets from {ASSETS_DIR}")
else:
    print(f"[AIB][UI] WARNING: assets dir not found at {ASSETS_DIR}")

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
app.include_router(ai_commands_router, prefix="/api/ai-builder")
