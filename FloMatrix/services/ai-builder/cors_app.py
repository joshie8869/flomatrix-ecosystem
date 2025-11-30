# services/ai-builder/cors_app.py
# Wrapper around your existing FloMatrix AI Builder FastAPI app
# that adds wide-open CORS for local tools like the AI Builder UI.

from fastapi.middleware.cors import CORSMiddleware

# Your working command was:
#   uvicorn aibuilder.main:app --host 0.0.0.0 --port 9000 --reload
# So the FastAPI app lives in aibuilder/main.py as "app".
from aibuilder.main import app as base_app

app = base_app

# Allow local tools (file:// origin -> "null", plus localhost ports)
origins = [
    "http://localhost",
    "http://127.0.0.1",
    "http://localhost:9000",
    "http://127.0.0.1:9000",
    "http://localhost:3000",
    "http://localhost:5173",
    "null",  # file:// origin shows up as "null" in CORS
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],       # wide open in dev
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
