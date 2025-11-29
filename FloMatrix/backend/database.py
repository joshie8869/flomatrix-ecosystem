# backend/database.py

from backend.models import User

# Simple in-memory user "database"
# Replace later with real DB (Postgres, etc.)
fake_users_db = {
    "admin": User(username="admin", password="admin123"),
}
