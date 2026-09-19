import datetime
import os
import uuid

from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS

import store
from disease_info import build_result
from inference import predict

app = Flask(__name__)

CORS_ORIGINS = [o.strip() for o in os.environ.get("CORS_ORIGINS", "*").split(",")]
CORS(app, origins=CORS_ORIGINS, supports_credentials=True)

# Shared secret the ESP32 devices send in X-Device-Key. Leave DEVICE_API_KEY
# unset in dev to skip the check; always set it in production.
DEVICE_API_KEY = os.environ.get("DEVICE_API_KEY", "")

# severities that should trigger the pump automatically when the camera
# (not a manual browser test) reports them
AUTO_DISPENSE_SEVERITIES = {"medium", "high"}

# Every analyzed leaf photo (camera or manual dashboard upload) is saved here
# so the dashboard/history can show it later. Same caveat as data.db: on
# Render's free tier this is ephemeral and resets on redeploy/restart.
UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

store.init_db()


def save_image(image_bytes: bytes) -> str:
    filename = f"{datetime.datetime.utcnow().strftime('%Y%m%dT%H%M%S')}-{uuid.uuid4().hex[:8]}.jpg"
    with open(os.path.join(UPLOAD_DIR, filename), "wb") as f:
        f.write(image_bytes)
    return filename


def image_url(filename):
    return f"/api/uploads/{filename}" if filename else None


def device_authorized(req) -> bool:
    if not DEVICE_API_KEY:
        return True  # no key configured — dev mode
    return req.headers.get("X-Device-Key") == DEVICE_API_KEY


def humanize(iso_ts):
    if not iso_ts:
        return "Never"
    dt = datetime.datetime.fromisoformat(iso_ts.replace("Z", ""))
    delta = datetime.datetime.utcnow() - dt
    secs = delta.total_seconds()
    if secs < 60:
        return "Just now"
    if secs < 3600:
        return f"{int(secs // 60)} min ago"
    if secs < 86400:
        return f"{int(secs // 3600)} hours ago"
    return f"{int(secs // 86400)} days ago"


@app.get("/api/health")
def health():
    return jsonify({"ok": True})


@app.get("/api/status")
def status():
    return jsonify(
        {
            "esp32_online": store.is_role_online("camera"),
            "pump_online": store.is_role_online("pump"),
            # kept for backward compatibility — mirrors pump 1 (the auto/pesticide pump)
            "last_dispensed": humanize(store.get_last_dispensed(1)),
            "pump1_last_dispensed": humanize(store.get_last_dispensed(1)),
            "pump2_last_dispensed": humanize(store.get_last_dispensed(2)),
            "detections_today": store.get_today_count(),
        }
    )


@app.get("/api/history")
def history():
    limit = request.args.get("limit", default=100, type=int)
    records = store.get_history(limit)
    for r in records:
        r["image_url"] = image_url(r.pop("image_filename"))
    return jsonify(records)


@app.get("/api/uploads/<path:filename>")
def uploaded_image(filename):
    return send_from_directory(UPLOAD_DIR, filename)


@app.post("/api/predict")
def api_predict():
    if "image" not in request.files:
        return jsonify({"error": "No image file under field name 'image'"}), 400

    image_bytes = request.files["image"].read()
    try:
        class_name, confidence = predict(image_bytes)
    except Exception as exc:  # noqa: BLE001 — surface a clean 400 to the caller
        return jsonify({"error": f"Could not read image: {exc}"}), 400

    result = build_result(class_name, confidence)
    saved_filename = save_image(image_bytes)

    # Only an authenticated camera device gets to auto-queue the pump —
    # a manual browser upload from the dashboard never triggers hardware.
    is_camera = request.headers.get("X-Device-Role") == "camera" and device_authorized(request)
    auto_dispense = is_camera and result["severity"] in AUTO_DISPENSE_SEVERITIES
    if auto_dispense:
        store.queue_dispense()

    store.log_detection(
        result["class"],
        result["confidence"],
        result["severity"],
        dispensed=auto_dispense,
        image_filename=saved_filename,
    )
    if is_camera:
        store.device_heartbeat(request.headers.get("X-Device-Id", "esp32-cam"), "camera")

    result["auto_dispense_queued"] = auto_dispense
    result["image_url"] = image_url(saved_filename)
    return jsonify(result)


@app.post("/api/dispense")
def api_dispense():
    """Manual trigger from the dashboard — queues the same command the
    pump ESP32 picks up on its next poll. Defaults to pump 1 (the
    pesticide pump) if no pump is specified, for backward compatibility."""
    data = request.get_json(silent=True) or {}
    pump = data.get("pump", 1)
    if pump not in (1, 2):
        return jsonify({"error": "pump must be 1 or 2"}), 400
    store.queue_dispense(pump)
    return jsonify({"queued": True, "pump": pump})


@app.get("/api/pump/command")
def pump_command():
    if not device_authorized(request):
        return jsonify({"error": "unauthorized"}), 401
    store.device_heartbeat(request.headers.get("X-Device-Id", "esp32-pump"), "pump")
    commands = store.get_and_clear_commands()
    return jsonify({"pump1": commands[1] or "none", "pump2": commands[2] or "none"})


@app.post("/api/pump/ack")
def pump_ack():
    if not device_authorized(request):
        return jsonify({"error": "unauthorized"}), 401
    data = request.get_json(silent=True) or {}
    pump = data.get("pump", 1)
    if pump not in (1, 2):
        return jsonify({"error": "pump must be 1 or 2"}), 400
    store.ack_dispense(pump)
    return jsonify({"ok": True})


@app.post("/api/device/heartbeat")
def device_heartbeat():
    if not device_authorized(request):
        return jsonify({"error": "unauthorized"}), 401
    data = request.get_json(silent=True) or {}
    device_id = data.get("device_id", "unknown")
    role = data.get("role", "unknown")
    store.device_heartbeat(device_id, role)
    return jsonify({"ok": True})


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 5000)), debug=True)
