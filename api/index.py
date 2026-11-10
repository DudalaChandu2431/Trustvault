import os
import sys
from pathlib import Path

# Add backend directory to sys.path so app module is discoverable
BACKEND_DIR = Path(__file__).resolve().parent / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.main import app
