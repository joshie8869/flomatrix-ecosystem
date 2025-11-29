# backend/utils/config.py
# Compatibility wrapper so imports like
# "from backend.utils.config import ALLOWED_ORIGINS" keep working.

from ...utils.config import *  # re-export everything from the real module
