# services/ai-builder/aibuilder/models.py
# Data models for FloMatrix AI Builder jobs

from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Dict, Any, List, Optional

from pydantic import BaseModel, Field


class JobType(str, Enum):
    INDICATOR = "indicator"
    DRAWING = "drawing"
    CHART_TYPE = "chart_type"
    ENGINE_PATCH = "engine_patch"
    ORDERFLOW_COMPONENT = "orderflow_component"
    UI_COMPONENT = "ui_component"
    JOURNAL_FEATURE = "journal_feature"


class JobMode(str, Enum):
    AUTO = "auto"
    APPROVAL_REQUIRED = "approval_required"


class JobStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    WAITING_FOR_APPROVAL = "waiting_for_approval"
    COMPLETED = "completed"
    FAILED = "failed"


class JobTarget(BaseModel):
    """
    Where the AI-generated code will be written.
    """

    path: str = Field(
        ...,
        description="Repository-relative path, e.g. 'app/engine/indicators/ema.js'",
    )
    file_type: str = Field(
        ...,
        description="Logical file type, e.g. 'js', 'css', 'html', 'shader'",
    )
    module_type: str = Field(
        ...,
        description="Domain module type: indicator|drawing|engine|ui|orderflow|exec",
    )


class JobInputs(BaseModel):
    """
    High-level structured inputs the AI can use when generating code.
    You can expand this over time.
    """

    indicator_name: Optional[str] = None
    drawing_name: Optional[str] = None
    description: Optional[str] = None

    # Arbitrary parameters (lengths, colors, etc.)
    params: Dict[str, Any] = Field(default_factory=dict)

    # Optional: blueprint IDs this job is meant to satisfy
    blueprint_ids: List[str] = Field(default_factory=list)


class AIJob(BaseModel):
    """
    Full AI Builder job object stored in memory and echoed via the API.
    """

    job_id: str
    job_type: JobType
    mode: JobMode = JobMode.APPROVAL_REQUIRED

    target: JobTarget
    inputs: JobInputs

    dependencies: List[str] = Field(default_factory=list)
    tests: List[str] = Field(default_factory=list)

    created_by: str = "admin"
    created_at: datetime = Field(default_factory=datetime.utcnow)

    status: JobStatus = JobStatus.PENDING

    # GitHub PR info (if approval_required)
    pr_number: Optional[int] = None
    pr_url: Optional[str] = None
