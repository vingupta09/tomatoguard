"""
Small SQLite store — detection history, device online-status, and the
one-row, two-pump command queue. Good enough for a single-worker
Flask/gunicorn deployment; not built for concurrent writers.
"""
import datetime
import os
import sqlite3
import threading

DB_PATH = os.path.join(os.path.dirname(__file__), "data.db")
_lock = threading.Lock()


def _conn():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    with _lock, _conn() as conn:
        conn.execute(
            """CREATE TABLE IF NOT EXISTS detections (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp TEXT NOT NULL,
                class TEXT NOT NULL,
                confidence REAL NOT NULL,
                severity TEXT NOT NULL,
                dispensed INTEGER NOT NULL DEFAULT 0
            )"""
        )
        conn.execute(
            """CREATE TABLE IF NOT EXISTS devices (
                device_id TEXT PRIMARY KEY,
                role TEXT NOT NULL,
                last_seen TEXT NOT NULL
            )"""
        )
        conn.execute(
            """CREATE TABLE IF NOT EXISTS pump_state (
                id INTEGER PRIMARY KEY CHECK (id = 1),
                pending_command_1 TEXT,
                pending_command_2 TEXT,
                last_dispensed_1 TEXT,
                last_dispensed_2 TEXT
            )"""
        )
        # Migrate a pre-existing single-pump database (older column names).
        existing_cols = {row["name"] for row in conn.execute("PRAGMA table_info(pump_state)")}
        if "pending_command" in existing_cols and "pending_command_1" not in existing_cols:
            conn.execute("ALTER TABLE pump_state ADD COLUMN pending_command_1 TEXT")
            conn.execute("ALTER TABLE pump_state ADD COLUMN pending_command_2 TEXT")
            conn.execute("ALTER TABLE pump_state ADD COLUMN last_dispensed_1 TEXT")
            conn.execute("ALTER TABLE pump_state ADD COLUMN last_dispensed_2 TEXT")
            conn.execute(
                "UPDATE pump_state SET pending_command_1 = pending_command, last_dispensed_1 = last_dispensed WHERE id = 1"
            )
        conn.execute(
            """INSERT OR IGNORE INTO pump_state (id, pending_command_1, pending_command_2, last_dispensed_1, last_dispensed_2)
               VALUES (1, NULL, NULL, NULL, NULL)"""
        )


def _now():
    return datetime.datetime.utcnow().isoformat(timespec="seconds") + "Z"


def log_detection(class_name: str, confidence: float, severity: str, dispensed: bool = False):
    with _lock, _conn() as conn:
        conn.execute(
            "INSERT INTO detections (timestamp, class, confidence, severity, dispensed) VALUES (?, ?, ?, ?, ?)",
            (_now(), class_name, confidence, severity, int(dispensed)),
        )


def get_history(limit: int = 100):
    with _lock, _conn() as conn:
        rows = conn.execute(
            "SELECT timestamp, class, confidence, severity, dispensed FROM detections ORDER BY id DESC LIMIT ?",
            (limit,),
        ).fetchall()
    return [
        {
            "timestamp": r["timestamp"],
            "class": r["class"],
            "confidence": r["confidence"],
            "severity": r["severity"],
            "dispensed": bool(r["dispensed"]),
        }
        for r in rows
    ]


def get_today_count():
    today = datetime.datetime.utcnow().strftime("%Y-%m-%d")
    with _lock, _conn() as conn:
        row = conn.execute(
            "SELECT COUNT(*) AS c FROM detections WHERE timestamp LIKE ?", (f"{today}%",)
        ).fetchone()
    return row["c"]


def device_heartbeat(device_id: str, role: str):
    with _lock, _conn() as conn:
        conn.execute(
            """INSERT INTO devices (device_id, role, last_seen) VALUES (?, ?, ?)
               ON CONFLICT(device_id) DO UPDATE SET role=excluded.role, last_seen=excluded.last_seen""",
            (device_id, role, _now()),
        )


def is_role_online(role: str, within_seconds: int = 30) -> bool:
    cutoff = datetime.datetime.utcnow() - datetime.timedelta(seconds=within_seconds)
    with _lock, _conn() as conn:
        rows = conn.execute("SELECT last_seen FROM devices WHERE role = ?", (role,)).fetchall()
    for r in rows:
        seen = datetime.datetime.fromisoformat(r["last_seen"].replace("Z", ""))
        if seen >= cutoff:
            return True
    return False


def _pump_column(prefix: str, pump: int) -> str:
    if pump not in (1, 2):
        raise ValueError(f"pump must be 1 or 2, got {pump!r}")
    return f"{prefix}_{pump}"


def queue_dispense(pump: int = 1):
    col = _pump_column("pending_command", pump)
    with _lock, _conn() as conn:
        conn.execute(f"UPDATE pump_state SET {col} = 'dispense' WHERE id = 1")


def get_and_clear_commands():
    """Returns {1: command_or_None, 2: command_or_None} and clears both."""
    with _lock, _conn() as conn:
        row = conn.execute(
            "SELECT pending_command_1, pending_command_2 FROM pump_state WHERE id = 1"
        ).fetchone()
        conn.execute(
            "UPDATE pump_state SET pending_command_1 = NULL, pending_command_2 = NULL WHERE id = 1"
        )
    return {
        1: row["pending_command_1"] if row else None,
        2: row["pending_command_2"] if row else None,
    }


def ack_dispense(pump: int = 1):
    col = _pump_column("last_dispensed", pump)
    with _lock, _conn() as conn:
        conn.execute(f"UPDATE pump_state SET {col} = ? WHERE id = 1", (_now(),))


def get_last_dispensed(pump: int = 1):
    col = _pump_column("last_dispensed", pump)
    with _lock, _conn() as conn:
        row = conn.execute(f"SELECT {col} FROM pump_state WHERE id = 1").fetchone()
    return row[col] if row else None
