# ==============================================================
# FloMatrix AI Builder — Main Application
# ==============================================================

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
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

app = FastAPI(
    title="FloMatrix AI Builder",
    version="1.0.0",
    description="AI microservice responsible for generating & committing code."
)

# --------------------------------------------------------------
# CORS (not strictly needed local, but correct for prod)
# --------------------------------------------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# --------------------------------------------------------------
# Startup Diagnostics (Very Important!)
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
# Routers
# --------------------------------------------------------------
app.include_router(job_router, prefix="/api/ai-builder")

