# services/ai-builder/aibuilder/routes.py
# AI Builder job endpoints

from fastapi import APIRouter, Depends, Request, HTTPException
from typing import Dict

from .models import AIJob, JobMode
from .llm_client import LLMClient
from .github_client import (
    github_write_file,
    github_create_branch,
    github_create_pr,
    github_merge_pr,
)
from .security import Security

router = APIRouter()
jobs: Dict[str, AIJob] = {}


async def auth_dependency(request: Request):
    """
    Simple shared-token + (optional) IP check.
    Raises HTTPException if not authorized.
    """
    await Security.enforce_auth(request)
    return True


@router.post("/jobs", dependencies=[Depends(auth_dependency)])
async def create_job(job: AIJob):
    """
    Create a new AI Builder job.
    """
    # Enforce Mode C rules on target path / mode
    Security.enforce_target_mode(job.target.path, job.mode.value)
    jobs[job.job_id] = job
    return {"job_id": job.job_id, "status": job.status}


@router.post("/jobs/{job_id}/run", dependencies=[Depends(auth_dependency)])
async def run_job(job_id: str):
    """
    Trigger LLM generation and GitHub write / PR for a job.
    """
    job = jobs.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    if job.status not in ("pending", "failed"):
        raise HTTPException(status_code=400, detail="Job not runnable in current status")

    job.status = "running"
    jobs[job_id] = job

    # Build the prompt – later we'll inject blueprint IDs, etc.
    prompt = (
        "You are the FloMatrix AI Builder.\n"
        f"Job type: {job.job_type.value}\n"
        f"Mode: {job.mode.value}\n"
        f"Target file: {job.target.path}\n"
        f"File type: {job.target.file_type}\n"
        f"Module type: {job.target.module_type}\n"
        f"Inputs: {job.inputs.json()}\n\n"
        "Output ONLY the complete code for this file. No explanations. "
        "Follow existing FloMatrix patterns and include required imports/exports."
    )

    code = LLMClient.generate(prompt)

    # MODE: AUTO → commit directly to main branch
    if job.mode == JobMode.AUTO:
        github_write_file(
            job.target.path,
            code,
            message=f"[AIB][{job.job_id}] Auto-generated {job.job_type.value}",
            branch=None,
        )
        job.status = "completed"
        jobs[job_id] = job
        return {"job_id": job_id, "status": job.status}

    # MODE: APPROVAL_REQUIRED → create feature branch + PR, don't merge
    branch_name = f"aib/{job.job_id}"
    github_create_branch(branch_name)
    github_write_file(
        job.target.path,
        code,
        message=f"[AIB][{job.job_id}] Generated {job.job_type.value} (approval required)",
        branch=branch_name,
    )

    pr = github_create_pr(
        branch_name=branch_name,
        title=f"[AIB] {job.job_type.value} for {job.target.path}",
        body="AI-generated change. Please review and approve.",
    )

    job.pr_number = pr.get("number")
    job.status = "waiting_for_approval"
    jobs[job_id] = job

    return {
        "job_id": job_id,
        "status": job.status,
        "pr_number": job.pr_number,
        "pr_url": pr.get("html_url"),
    }


@router.post("/jobs/{job_id}/approve", dependencies=[Depends(auth_dependency)])
async def approve_job(job_id: str):
    """
    Merge the PR created for an approval_required job.
    """
    job = jobs.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    if job.mode != JobMode.APPROVAL_REQUIRED:
        raise HTTPException(status_code=400, detail="Job is not approval_required")

    if job.status != "waiting_for_approval":
        raise HTTPException(status_code=400, detail="Job not in approval state")

    if not job.pr_number:
        raise HTTPException(status_code=400, detail="No PR attached to this job")

    merge_result = github_merge_pr(job.pr_number)
    job.status = "completed"
    jobs[job_id] = job

    return {
        "job_id": job_id,
        "status": job.status,
        "merge": merge_result,
    }


@router.get("/jobs/{job_id}", dependencies=[Depends(auth_dependency)])
async def get_job(job_id: str):
    """
    Get a single job.
    """
    job = jobs.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job


@router.get("/jobs", dependencies=[Depends(auth_dependency)])
async def list_jobs():
    """
    List all jobs in memory.
    """
    return list(jobs.values())
