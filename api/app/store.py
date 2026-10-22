"""SQLite persistence: cached cards/quizzes per term, and quiz sessions with their answer keys.

Survives restarts, so a quiz link never "expires" just because the server reloaded.
"""

import json
import sqlite3
import threading
import time
from pathlib import Path

from .schemas import QuizQuestion, TermCard

SESSION_TTL = 7 * 24 * 3600  # quiz sessions older than a week are pruned


class Store:
    def __init__(self, path: Path):
        path.parent.mkdir(parents=True, exist_ok=True)
        self._db = sqlite3.connect(path, check_same_thread=False, isolation_level=None)
        self._db.execute("PRAGMA journal_mode=WAL")
        self._lock = threading.Lock()
        self._db.executescript(
            """
            CREATE TABLE IF NOT EXISTS cards (
                key TEXT PRIMARY KEY, card TEXT NOT NULL, source TEXT NOT NULL, created REAL NOT NULL);
            CREATE TABLE IF NOT EXISTS quizzes (
                key TEXT PRIMARY KEY, questions TEXT NOT NULL, created REAL NOT NULL);
            CREATE TABLE IF NOT EXISTS sessions (
                id TEXT PRIMARY KEY, key TEXT NOT NULL, term TEXT NOT NULL,
                questions TEXT, created REAL NOT NULL);
            """
        )
        self.prune()

    def _exec(self, sql: str, params: tuple = ()):
        with self._lock:
            return self._db.execute(sql, params).fetchone()

    # --- cards ---
    def get_card(self, key: str) -> tuple[TermCard, str] | None:
        row = self._exec("SELECT card, source FROM cards WHERE key = ?", (key,))
        return (TermCard.model_validate_json(row[0]), row[1]) if row else None

    def put_card(self, key: str, card: TermCard, source: str) -> None:
        self._exec(
            "INSERT OR REPLACE INTO cards VALUES (?, ?, ?, ?)", (key, card.model_dump_json(), source, time.time())
        )

    # --- quizzes (shared per term) ---
    def get_quiz(self, key: str) -> list[QuizQuestion] | None:
        row = self._exec("SELECT questions FROM quizzes WHERE key = ?", (key,))
        return [QuizQuestion(**q) for q in json.loads(row[0])] if row else None

    def put_quiz(self, key: str, questions: list[QuizQuestion]) -> None:
        payload = json.dumps([q.model_dump() for q in questions])
        self._exec("INSERT OR REPLACE INTO quizzes VALUES (?, ?, ?)", (key, payload, time.time()))

    # --- sessions (one per quiz attempt, holds the shuffled answer key) ---
    def create_session(self, session_id: str, key: str, term: str) -> None:
        self._exec("INSERT INTO sessions VALUES (?, ?, ?, NULL, ?)", (session_id, key, term, time.time()))

    def get_session(self, session_id: str) -> tuple[str, str, list[QuizQuestion] | None] | None:
        row = self._exec("SELECT key, term, questions FROM sessions WHERE id = ?", (session_id,))
        if not row:
            return None
        questions = [QuizQuestion(**q) for q in json.loads(row[2])] if row[2] else None
        return row[0], row[1], questions

    def set_session_questions(self, session_id: str, questions: list[QuizQuestion]) -> None:
        payload = json.dumps([q.model_dump() for q in questions])
        # Only the first writer wins, so two parallel fetches can't end up with different answer keys.
        self._exec("UPDATE sessions SET questions = ? WHERE id = ? AND questions IS NULL", (payload, session_id))

    def prune(self) -> None:
        self._exec("DELETE FROM sessions WHERE created < ?", (time.time() - SESSION_TTL,))
