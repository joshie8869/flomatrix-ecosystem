# services/ai-builder/aibuilder/github_client.py
# Stub GitHub client for FloMatrix AI Builder.
# Right now it just logs actions instead of calling the real GitHub API.

from __future__ import annotations

from typing import Optional, Dict


def github_write_file(path: str, content: str, message: str, branch: Optional[str] = None) -> Dict:
    """
    TEMP: instead of writing to GitHub, just print and pretend success.
    """
    print("[AIB][GITHUB] write_file")
    print("  path   :", path)
    print("  branch :", branch or "main")
    print("  message:", message)
    print("  content length:", len(content))
    # In real implementation, this would call GitHub's API.
    return {"path": path, "branch": branch or "main", "message": message}


def github_create_branch(branch_name: str) -> Dict:
    print("[AIB][GITHUB] create_branch:", branch_name)
    return {"branch": branch_name}


def github_create_pr(branch_name: str, title: str, body: str) -> Dict:
    print("[AIB][GITHUB] create_pr:", branch_name, title)
    # Fake PR number 1 for now
    return {"number": 1, "html_url": f"https://example.com/fake-pr/{branch_name}"}


def github_merge_pr(pr_number: int) -> Dict:
    print("[AIB][GITHUB] merge_pr:", pr_number)
    return {"merged": True, "pr_number": pr_number}
