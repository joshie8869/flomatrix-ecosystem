# services/ai-builder/aibuilder/github_client.py
# Local "GitHub" client for FloMatrix AI Builder.
#
# RIGHT NOW: writes directly into your local FloMatrix repo on disk,
# instead of calling the real GitHub API.
#
# Later we can swap this to REAL GitHub commits + PRs.

from __future__ import annotations

import os
from datetime import datetime
from pathlib import Path
from typing import Optional, Dict

# 👇👀 IMPORTANT: this is the ROOT of your FloMatrix repo on your laptop.
# Adjust this if your path ever changes.
REPO_ROOT = Path(r"C:\AnyChart\FloMatrix").resolve()


def _resolve_repo_path(rel_path: str) -> Path:
    """
    Convert a repo-relative path like:
        'app/engine/indicators/test_indicator.js'
    into an absolute filesystem path under REPO_ROOT.
    """
    # Normalize slashes so Windows is happy
    safe_rel = rel_path.replace("/", os.sep).lstrip("\\/")
    return REPO_ROOT / safe_rel


def github_write_file(path: str, content: str, message: str, branch: Optional[str] = None) -> Dict:
    """
    "GitHub write" that actually writes to your LOCAL repo.
    No network, no real GitHub yet.
    """

    fs_path = _resolve_repo_path(path)
    fs_path.parent.mkdir(parents=True, exist_ok=True)

    # Write the content to disk
    fs_path.write_text(content, encoding="utf-8")

    now = datetime.utcnow().isoformat() + "Z"

    print("[AIB][GITHUB-LOCAL] write_file")
    print("  repo root   :", REPO_ROOT)
    print("  rel path    :", path)
    print("  fs path     :", fs_path)
    print("  branch      :", branch or "main")
    print("  message     :", message)
    print("  written len :", len(content))
    print("  at          :", now)

    return {
        "repo_root": str(REPO_ROOT),
        "path": path,
        "fs_path": str(fs_path),
        "branch": branch or "main",
        "message": message,
        "written_at": now,
    }


def github_create_branch(branch_name: str) -> Dict:
    # Local dev: just log and pretend success
    print("[AIB][GITHUB-LOCAL] create_branch:", branch_name)
    return {"branch": branch_name}


def github_create_pr(branch_name: str, title: str, body: str) -> Dict:
    print("[AIB][GITHUB-LOCAL] create_pr:", branch_name, title)
    # Fake PR number 1 for now
    return {"number": 1, "html_url": f"https://example.com/local-pr/{branch_name}"}


def github_merge_pr(pr_number: int) -> Dict:
    print("[AIB][GITHUB-LOCAL] merge_pr:", pr_number)
    return {"merged": True, "pr_number": pr_number}
