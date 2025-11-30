# ================================================================
# FloMatrix AI Builder — Configuration File
# Mode C (Dual-Mode Security)
# ================================================================

import os
from dotenv import load_dotenv

# ------------------------------------------------
# Load .env file that lives next to this config.py
# ------------------------------------------------
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
ENV_PATH = os.path.join(BASE_DIR, ".env")

# This loads:
#   OPENAI_API_KEY=...
#   OPENAI_MODEL=...
#   GITHUB_TOKEN=...
#   GITHUB_REPO=...
load_dotenv(ENV_PATH)

# ------------------------------------------------
# OpenAI / LLM Credentials
# ------------------------------------------------
# NOTE: we reference the ENV VARIABLE NAME here,
#       *NOT* the long key itself.
OPENAI_API_KEY = os.getenv("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", "")
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4.1-mini")

if not OPENAI_API_KEY:
    raise ValueError(
        "❌ OPENAI_API_KEY is missing. Set it in your .env file (OPENAI_API_KEY=...) "
        "or in the environment."
    )

# ------------------------------------------------
# GitHub Bot Credentials
# ------------------------------------------------
GITHUB_TOKEN = os.getenv("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", "")
GITHUB_REPO = os.getenv("GITHUB_REPO", "joshie8869/flomatrix-ecosystem")

if not GITHUB_TOKEN:
    raise ValueError(
        "❌ GITHUB_TOKEN is missing. Set it in your .env file (GITHUB_TOKEN=...) "
        "or in the environment."
    )

# Optional: small helper dict if other modules want everything at once
SETTINGS = {
    "OPENAI_API_KEY": OPENAI_API_KEY,
    "OPENAI_MODEL": OPENAI_MODEL,
    "GITHUB_TOKEN": GITHUB_TOKEN,
    "GITHUB_REPO": GITHUB_REPO,
}
