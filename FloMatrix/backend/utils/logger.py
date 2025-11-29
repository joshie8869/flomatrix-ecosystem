# backend/utils/logger.py

import datetime


def log(msg: str) -> None:
    """
    Simple logger that prints messages with a UTC timestamp.
    """
    t = datetime.datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")
    print(f"[{t} UTC] {msg}")
