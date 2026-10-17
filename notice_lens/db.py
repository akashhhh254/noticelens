"""SQLite database management for NoticeLens coordinator view."""
import json
import os
import random
import string
import sqlite3
from typing import Any

DB_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "noticelens.db")


def get_connection(db_path: str = DB_PATH) -> sqlite3.Connection:
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    return conn


def init_db(db_path: str = DB_PATH) -> None:
    conn = get_connection(db_path)
    with conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS published_notices (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                text TEXT NOT NULL,
                events_json TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
    conn.close()


def generate_id(length: int = 8) -> str:
    alphabet = string.ascii_letters + string.digits
    return "".join(random.choices(alphabet, k=length))


def publish_notice(title: str, text: str, events: list[dict], db_path: str = DB_PATH) -> str:
    init_db(db_path)
    conn = get_connection(db_path)
    notice_id = generate_id(8)
    with conn:
        conn.execute(
            "INSERT INTO published_notices (id, title, text, events_json) VALUES (?, ?, ?, ?)",
            (notice_id, title, text, json.dumps(events))
        )
    conn.close()
    return notice_id


def get_published_notice(notice_id: str, db_path: str = DB_PATH) -> dict[str, Any] | None:
    init_db(db_path)
    conn = get_connection(db_path)
    cursor = conn.cursor()
    cursor.execute("SELECT id, title, text, events_json, created_at FROM published_notices WHERE id = ?", (notice_id,))
    row = cursor.fetchone()
    conn.close()
    if not row:
        return None
    return {
        "id": row["id"],
        "title": row["title"],
        "text": row["text"],
        "events": json.loads(row["events_json"]),
        "created_at": row["created_at"],
    }
