# ================================================================
# FloMatrix AI Builder — Configuration File
# Mode C (Dual-Mode Security)
# ================================================================

import os
from pathlib import Path

from dotenv import load_dotenv

# ------------------------------------------------
# Locate and load .env (same folder as this file)
# ------------------------------------------------
BASE_DIR = Path(__file__).resolve().parent
ENV_PATH = BASE_DIR / ".env"

if ENV_PATH.exists():
    load_dotenv(dotenv_path=str(ENV_PATH), override=True)
    print(f"[AIB][CONFIG] Loaded .env from {ENV_PATH}")
else:
    load_dotenv()
    print("[AIB][CONFIG] .env not found next to config.py, using default search")

# ------------------------------------------------
# OpenAI / LLM Credentials
# ------------------------------------------------

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4.1-mini")

print(f"[AIB][CONFIG] OPENAI_API_KEY present? {bool(OPENAI_API_KEY)}")
print(f"[AIB][CONFIG] OPENAI_MODEL = {OPENAI_MODEL}")

if not OPENAI_API_KEY:
    raise ValueError(
        "❌ OPENAI_API_KEY is missing. Set it in your .env file (OPENAI_API_KEY=...) "
        "or in the environment."
    )

# ------------------------------------------------
# GitHub Bot Credentials
# ------------------------------------------------

GITHUB_TOKEN = os.getenv("GITHUB_TOKEN", "")
GITHUB_REPO = os.getenv("GITHUB_REPO", "joshie8869/flomatrix-ecosystem")

print(f"[AIB][CONFIG] GITHUB_TOKEN present? {bool(GITHUB_TOKEN)}")
print(f"[AIB][CONFIG] GITHUB_REPO = {GITHUB_REPO}")

if not GITHUB_TOKEN:
    raise ValueError(
        "❌ GITHUB_TOKEN is missing. Set it in your .env file (GITHUB_TOKEN=...) "
        "or in the environment."
    )

# ------------------------------------------------
# Mode C – Security / Approval Rules
# ------------------------------------------------

# Who is allowed to approve “dangerous” jobs in Mode C
ADMIN_USER = "josh"          # adjust if your backend uses a different username
ADMIN_EMAIL = "you@example.com"  # optional, for future email notifications

# Paths the AI can touch automatically (no approval needed)
AUTO_ALLOWED_PREFIXES = [
    "app/engine/indicators/",
    "app/engine/drawings/",
    "app/engine/chart_types/",
    "app/engine/ui/",
    "app/engine/ai/",
]

# Paths that require explicit human approval (PR + approve button)
APPROVAL_REQUIRED_PREFIXES = [
    "app/engine/execution/",
    "app/engine/orderflow/",
    "app/engine/risk/",
    "backend/",
]

# Paths the AI is NEVER allowed to touch (hard blocked)
PROTECTED_PATH_PREFIXES = [
    "backend/app/",
    "backend/data_engines/",
    "backend/models/",
    "backend/database.py",
    "services/ai-builder/",         # don’t let the AI rewrite itself
]

MODE_C_ENABLED = True  # Dual-mode protection is on

# ------------------------------------------------
# Bundle for convenient import
# ------------------------------------------------

SETTINGS = {
    "OPENAI_API_KEY": OPENAI_API_KEY,
    "OPENAI_MODEL": OPENAI_MODEL,
    "GITHUB_TOKEN": GITHUB_TOKEN,
    "GITHUB_REPO": GITHUB_REPO,
    "ADMIN_USER": ADMIN_USER,
    "ADMIN_EMAIL": ADMIN_EMAIL,
    "AUTO_ALLOWED_PREFIXES": AUTO_ALLOWED_PREFIXES,
    "APPROVAL_REQUIRED_PREFIXES": APPROVAL_REQUIRED_PREFIXES,
    "PROTECTED_PATH_PREFIXES": PROTECTED_PATH_PREFIXES,
    "MODE_C_ENABLED": MODE_C_ENABLED,
}
