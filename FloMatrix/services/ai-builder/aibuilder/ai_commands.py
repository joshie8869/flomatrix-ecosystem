# aibuilder/ai_commands.py
# FloMatrix AI Command API v1.0
#
# Exposes /api/ai-builder/ai-command for bots to:
#  - READ_FILE
#  - LIST_DIR
#  - PATCH_FILE (full replace)
#  - CREATE_FILE
#
# Uses fm_schematic_v1.yml to resolve modules, roots, and safety rules.

from __future__ import annotations

from pathlib import Path
from typing import Any, Dict, List, Literal, Optional

import yaml
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field, validator

router = APIRouter(tags=["ai-commands"])

# -------------------------------------------------------------------
# Locate & load schematic
# -------------------------------------------------------------------

SCHEMATIC_CANDIDATES = [
    Path("/var/www/flomatrix/fm_schematic_v1.yml"),  # VPS default
    # Local dev fallback (C:\AnyChart\FloMatrix\fm_schematic_v1.yml)
    Path(__file__).resolve().parents[3] / "fm_schematic_v1.yml",
]

_schematic_cache: Dict[str, Any] | None = None
_schematic_source: Optional[Path] = None


def load_schematic() -> Dict[str, Any]:
    """Load fm_schematic_v1.yml (cached)."""
    global _schematic_cache, _schematic_source
    if _schematic_cache is not None:
        return _schematic_cache

    last_error: Optional[Exception] = None

    for candidate in SCHEMATIC_CANDIDATES:
        try:
            if candidate.exists():
                data = yaml.safe_load(candidate.read_text(encoding="utf-8")) or {}
                _schematic_cache = data
                _schematic_source = candidate
                print(f"[AIB][SCHEMA] Loaded schematic: {candidate}")
                return data
        except Exception as exc:  # noqa: BLE001
            last_error = exc

    msg = "fm_schematic_v1.yml not found or failed to parse."
    if last_error is not None:
        msg += f" Last error: {last_error}"
    print(f"[AIB][SCHEMA] WARNING: {msg}")
    raise RuntimeError(msg)


def _find_module(modules: List[Dict[str, Any]], module_id: str) -> Dict[str, Any]:
    for m in modules:
        if m.get("id") == module_id:
            return m
    raise HTTPException(status_code=400, detail=f"Unknown module_id: {module_id}")


def resolve_module_root(module_id: str) -> Path:
    schematic = load_schematic()
    fm = schematic.get("fm_schematic") or {}
    modules = fm.get("modules") or []
    module = _find_module(modules, module_id)
    root_str = module.get("root")
    if not root_str:
        raise HTTPException(status_code=500, detail=f"Module {module_id} has no root in schematic.")
    root = Path(root_str).resolve()
    return root


# -------------------------------------------------------------------
# Safety helpers
# -------------------------------------------------------------------

DENY_PATTERNS = [
    "__pycache__",
    "/venv/",
    "node_modules",
]


def _is_denied_path(p: Path) -> bool:
    text = str(p)
    for pattern in DENY_PATTERNS:
        if pattern in text:
            return True
    return False


def resolve_target_path(module_id: str, target_path: str) -> Path:
    root = resolve_module_root(module_id)
    abs_path = (root / target_path).resolve()

    # Prevent escape outside module root
    try:
        abs_path.relative_to(root)
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail=f"Target path escapes module root: {abs_path} (root={root})",
        )

    if _is_denied_path(abs_path):
        raise HTTPException(status_code=400, detail=f"Target path not allowed: {abs_path}")

    return abs_path


# -------------------------------------------------------------------
# Pydantic models
# -------------------------------------------------------------------

CommandType = Literal["READ_FILE", "LIST_DIR", "PATCH_FILE", "CREATE_FILE"]
RiskLevel = Literal["low", "medium", "high"]


class AICommand(BaseModel):
    version: str = Field("1.0", description="Command schema version.")
    command_type: CommandType
    module_id: str = Field(..., description="Module ID from fm_schematic (e.g., backend.api).")
    target_path: Optional[str] = Field(
        None,
        description="Path relative to module root (e.g., routes/test.py). Required for file operations.",
    )
    depth: Optional[int] = Field(
        1,
        description="Directory depth for LIST_DIR (1 = immediate children).",
    )
    body: Optional[str] = Field(
        None,
        description="Full file contents for PATCH_FILE / CREATE_FILE.",
    )
    rationale: Optional[str] = Field(
        None,
        description="Why this command is being executed (for logs / audit).",
    )
    risk_level: RiskLevel = Field(
        "medium",
        description="Self-assessed risk level of the operation.",
    )
    extra: Dict[str, Any] = Field(
        default_factory=dict,
        description="Additional fields for future extensions.",
    )

    @validator("target_path", always=True)
    def validate_target_path(cls, v: Optional[str], values: Dict[str, Any]) -> Optional[str]:  # noqa: D417
        ct = values.get("command_type")
        if ct in ("READ_FILE", "LIST_DIR", "PATCH_FILE", "CREATE_FILE") and not v:
            raise ValueError("target_path is required for this command_type.")
        return v

    @validator("body", always=True)
    def validate_body(cls, v: Optional[str], values: Dict[str, Any]) -> Optional[str]:  # noqa: D417
        ct = values.get("command_type")
        if ct in ("PATCH_FILE", "CREATE_FILE") and not v:
            raise ValueError("body is required for PATCH_FILE / CREATE_FILE.")
        return v


class AICommandResult(BaseModel):
    status: Literal["ok", "error"]
    message: str
    data: Optional[Dict[str, Any]] = None


# -------------------------------------------------------------------
# Command executor
# -------------------------------------------------------------------

def _execute_read_file(cmd: AICommand) -> AICommandResult:
    path = resolve_target_path(cmd.module_id, cmd.target_path or "")
    if not path.exists() or not path.is_file():
        raise HTTPException(status_code=404, detail=f"File not found: {path}")

    text = path.read_text(encoding="utf-8")
    # Avoid massive responses; truncate if huge
    max_len = 100_000
    truncated = len(text) > max_len
    if truncated:
        text = text[:max_len]

    return AICommandResult(
        status="ok",
        message="File read successfully." + (" (truncated)" if truncated else ""),
        data={"path": str(path), "content": text},
    )


def _execute_list_dir(cmd: AICommand) -> AICommandResult:
    path = resolve_target_path(cmd.module_id, cmd.target_path or "")
    if not path.exists() or not path.is_dir():
        raise HTTPException(status_code=404, detail=f"Directory not found: {path}")

    depth = cmd.depth or 1
    root = path
    results: List[Dict[str, Any]] = []

    for p in root.rglob("*"):
        try:
            rel = p.relative_to(root)
        except ValueError:
            continue
        # Depth filter
        if len(rel.parts) > depth:
            continue
        results.append(
            {
                "relative_path": str(rel),
                "is_dir": p.is_dir(),
                "size": p.stat().st_size if p.is_file() else None,
            }
        )

    return AICommandResult(
        status="ok",
        message=f"Listed {len(results)} entries under {path}",
        data={"root": str(path), "entries": results},
    )


def _backup_file(path: Path) -> None:
    if not path.exists():
        return
    backup = path.with_suffix(path.suffix + ".bak")
    try:
        backup.write_text(path.read_text(encoding="utf-8"), encoding="utf-8")
    except Exception:
        # Best-effort backup; failures should not block patching.
        pass


def _execute_patch_file(cmd: AICommand) -> AICommandResult:
    path = resolve_target_path(cmd.module_id, cmd.target_path or "")
    _backup_file(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(cmd.body or "", encoding="utf-8")

    return AICommandResult(
        status="ok",
        message=f"Patched file at {path}",
        data={"path": str(path)},
    )


def _execute_create_file(cmd: AICommand) -> AICommandResult:
    path = resolve_target_path(cmd.module_id, cmd.target_path or "")
    if path.exists():
        # For now, treat as overwrite with backup
        _backup_file(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(cmd.body or "", encoding="utf-8")

    return AICommandResult(
        status="ok",
        message=f"Created/overwrote file at {path}",
        data={"path": str(path)},
    )


# -------------------------------------------------------------------
# Route
# -------------------------------------------------------------------

@router.post("/ai-command", response_model=AICommandResult)
async def handle_ai_command(cmd: AICommand) -> AICommandResult:
    """
    Main entrypoint for AI agents.

    Dispatches based on command_type and enforces schematic-/module-based
    path resolution and safety constraints.
    """
    try:
        if cmd.command_type == "READ_FILE":
            return _execute_read_file(cmd)
        if cmd.command_type == "LIST_DIR":
            return _execute_list_dir(cmd)
        if cmd.command_type == "PATCH_FILE":
            return _execute_patch_file(cmd)
        if cmd.command_type == "CREATE_FILE":
            return _execute_create_file(cmd)

        raise HTTPException(status_code=400, detail=f"Unsupported command_type: {cmd.command_type}")
    except HTTPException:
        # Re-raise FastAPI HTTPExceptions
        raise
    except Exception as exc:  # noqa: BLE001
        # Catch-all: surface as error in result
        return AICommandResult(
            status="error",
            message=f"Unhandled error while executing command: {exc}",
            data=None,
        )


# -------------------------------------------------------------------
# Import-time banner (so you see it on startup)
# -------------------------------------------------------------------

print("[AIB][COMMANDS] AI Command Engine Online (router=ai-commands)")

# Best-effort schematic warmup so you see success/warning on startup.
try:
    load_schematic()
except Exception:
    # load_schematic() already printed a warning; don't crash import
    pass
