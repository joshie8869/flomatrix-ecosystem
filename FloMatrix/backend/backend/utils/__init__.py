# backend/utils/__init__.py
# Make backend.utils behave like the real utils package

from ... import utils as _real_utils
from ...utils.config import *   # optional, but fine
from ...utils.logger import *   # optional, but fine
