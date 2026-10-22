import os
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

BASE_DIR = Path(__file__).resolve().parent.parent

PRIMARY_MODEL = os.getenv("TERMSNAP_LLM_T1", "ollama:gemma4:31b-cloud")
PRIMARY_KEY = os.getenv("TERMSNAP_LLM_T1_KEY", "")
FALLBACK_MODEL = os.getenv("TERMSNAP_LLM_T2", "")
FALLBACK_KEY = os.getenv("TERMSNAP_LLM_T2_KEY", "")

CORS_ORIGINS = [o.strip() for o in os.getenv("TERMSNAP_CORS_ORIGINS", "http://localhost:3000").split(",") if o.strip()]
DB_PATH = Path(os.getenv("TERMSNAP_DB_PATH", BASE_DIR / "data" / "termsnap.db"))
LLM_TIMEOUT = float(os.getenv("TERMSNAP_LLM_TIMEOUT", "90"))

# Bump when prompts or schemas change so old cached cards are ignored.
CACHE_VERSION = "v2"
