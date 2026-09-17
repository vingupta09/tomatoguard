"""
Small SQLite store — detection history, device online-status, and the
one-row pump command queue. Good enough for a single-worker Flask/gunicorn
deployment; not built for concurrent writers.
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
                pending_command TEXT,
                last_dispensed TEXT
            )"""
        )
        conn.execute(
            "INSERT OR IGNORE INTO pump_state (id, pending_command, last_dispensed) VALUES (1, NULL, NULL)"
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


def queue_dispense():
    with _lock, _conn() as conn:
        conn.execute("UPDATE pump_state SET pending_command = 'dispense' WHERE id = 1")


def get_and_clear_command():
    with _lock, _conn() as conn:
        row = conn.execute("SELECT pending_command FROM pump_state WHERE id = 1").fetchone()
        conn.execute("UPDATE pump_state SET pending_command = NULL WHERE id = 1")
    return row["pending_command"] if row else None


def ack_dispense():
    with _lock, _conn() as conn:
        conn.execute("UPDATE pump_state SET last_dispensed = ? WHERE id = 1", (_now(),))


def get_last_dispensed():
    with _lock, _conn() as conn:
        row = conn.execute("SELECT last_dispensed FROM pump_state WHERE id = 1").fetchone()
    return row["last_dispensed"] if row else None
