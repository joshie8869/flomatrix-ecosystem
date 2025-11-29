# services/ai-builder/aibuilder/main.py
# FastAPI app for FloMatrix AI Builder microservice

from fastapi import FastAPI
from .routes import router as job_router

# This MUST be named "app" so Uvicorn can find it
app = FastAPI(
    title="FloMatrix AI Builder",
    version="1.0.0",
    description="AI microservice that generates code for FloMatrix based on jobs.",
)


# All routes live under /api/ai-builder
app.include_router(job_router, prefix="/api/ai-builder")
