import datetime
import io
import os
import threading
import uuid

import numpy as np
from PIL import Image

from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS

import store
from disease_info import build_result
from inference import predict


# ============================================================
# APP CONFIGURATION
# ============================================================

app = Flask(__name__)


CORS_ORIGINS = [
    origin.strip()
    for origin in os.environ.get(
        "CORS_ORIGINS",
        "*"
    ).split(",")
]


CORS(
    app,
    origins=CORS_ORIGINS,
    supports_credentials=True
)


# ============================================================
# DEVICE AUTHENTICATION
# ============================================================

DEVICE_API_KEY = os.environ.get(
    "DEVICE_API_KEY",
    ""
)


# --------------------------------------------------------
# Should the camera's photo upload ALSO need the secret key?
#
#   false (default): a request that says "X-Device-Role: camera"
#                    is accepted as the camera. The pump board
#                    and /api/pump/* still need the key.
#   true           : the camera must also send a matching
#                    X-Device-Key, otherwise it is ignored.
#
# Set REQUIRE_CAMERA_KEY=true on Render once the camera's key
# is confirmed correct and /api/dispense is protected.
# --------------------------------------------------------

REQUIRE_CAMERA_KEY = (
    os.environ.get(
        "REQUIRE_CAMERA_KEY",
        "false"
    ).strip().lower()
    in ("1", "true", "yes")
)


# ============================================================
# AUTO-SPRAY SAFETY SETTINGS
# ============================================================
#
# The model has no "not a leaf" class, so it will label ANY object
# (a hand, a desk, a wall) as healthy / fungal / non-fungal.
# To stop the pump spraying at random objects, an automatic spray
# needs ALL of these to be true:
#
#   1. AUTO MODE is switched ON (button on the dashboard)
#   2. the photo looks like a leaf (enough green/yellow-green pixels)
#   3. the model is confident enough
#
# Change them on Render > Environment (no code change needed):
#
#   AUTO_MODE_DEFAULT = true / false   (state after a restart, default false)
#   LEAF_MIN_GREEN    = 0.15           (0 turns the leaf check off)
#   MIN_CONFIDENCE    = 0.80           (0 turns the confidence check off)
#
# ============================================================

def _env_flag(name, default):

    return (
        os.environ.get(
            name,
            default
        ).strip().lower()
        in ("1", "true", "yes", "on")
    )


def _env_float(name, default):

    try:

        return float(
            os.environ.get(
                name,
                default
            )
        )

    except ValueError:

        return float(default)


AUTO_MODE_DEFAULT = _env_flag(
    "AUTO_MODE_DEFAULT",
    "false"
)

LEAF_MIN_GREEN = _env_float(
    "LEAF_MIN_GREEN",
    "0.15"
)

MIN_CONFIDENCE = _env_float(
    "MIN_CONFIDENCE",
    "0.80"
)


# Auto mode lives in memory. With one gunicorn worker that is enough.
# After a redeploy or restart it goes back to AUTO_MODE_DEFAULT.
_auto_mode = {
    "enabled": AUTO_MODE_DEFAULT
}

_auto_mode_lock = threading.Lock()


def auto_mode_enabled():

    with _auto_mode_lock:

        return _auto_mode["enabled"]


def set_auto_mode(enabled):

    with _auto_mode_lock:

        _auto_mode["enabled"] = bool(
            enabled
        )

        return _auto_mode["enabled"]


def leaf_green_ratio(image_bytes):
    """
    Share of pixels (0.0 - 1.0) that are leaf-coloured:
    green to yellow-green, reasonably saturated.

    Hands, walls, desks, screens and most everyday objects score
    close to 0. A leaf, even with brown spots, scores well above it.
    """

    img = Image.open(
        io.BytesIO(image_bytes)
    ).convert("RGB")

    img.thumbnail((160, 160))

    hsv = np.asarray(
        img.convert("HSV"),
        dtype=np.float32
    ) / 255.0

    hue = hsv[..., 0]
    sat = hsv[..., 1]
    val = hsv[..., 2]

    # hue 0.10 - 0.45  = about 36 - 162 degrees (yellow-green .. green)
    mask = (
        (hue >= 0.10)
        & (hue <= 0.45)
        & (sat >= 0.20)
        & (val >= 0.15)
    )

    return float(
        mask.mean()
    )


def device_authorized(req):
    """
    Check the device API key.

    If DEVICE_API_KEY is not configured on the server,
    authentication is allowed for development/testing.
    """

    if not DEVICE_API_KEY:
        return True

    return (
        req.headers.get("X-Device-Key")
        == DEVICE_API_KEY
    )


# ============================================================
# IMAGE STORAGE
# ============================================================

UPLOAD_DIR = os.path.join(
    os.path.dirname(__file__),
    "uploads"
)


os.makedirs(
    UPLOAD_DIR,
    exist_ok=True
)


# Initialize database
store.init_db()


def save_image(image_bytes):
    """
    Save uploaded camera image and return filename.
    """

    filename = (
        datetime.datetime.utcnow().strftime(
            "%Y%m%dT%H%M%S"
        )
        + "-"
        + uuid.uuid4().hex[:8]
        + ".jpg"
    )


    filepath = os.path.join(
        UPLOAD_DIR,
        filename
    )


    with open(
        filepath,
        "wb"
    ) as f:

        f.write(
            image_bytes
        )


    return filename


def image_url(filename):
    """
    Convert stored filename into API URL.
    """

    if not filename:
        return None

    return (
        "/api/uploads/"
        + filename
    )


def remove_history_images(filenames):
    """
    Delete image files that were removed from history.
    """

    for filename in filenames:

        if not filename:
            continue


        # Safety check
        if os.path.basename(filename) != filename:

            raise ValueError(
                f"Invalid image filename: {filename!r}"
            )


        try:

            os.remove(
                os.path.join(
                    UPLOAD_DIR,
                    filename
                )
            )

        except FileNotFoundError:

            pass


# ============================================================
# TIME / STATUS HELPERS
# ============================================================

def humanize(iso_ts):
    """
    Convert an ISO timestamp into a simple human-readable age.
    """

    if not iso_ts:
        return "Never"


    dt = datetime.datetime.fromisoformat(
        iso_ts.replace(
            "Z",
            ""
        )
    )


    delta = (
        datetime.datetime.utcnow()
        - dt
    )


    seconds = (
        delta.total_seconds()
    )


    if seconds < 60:
        return "Just now"


    if seconds < 3600:
        return (
            f"{int(seconds // 60)} min ago"
        )


    if seconds < 86400:
        return (
            f"{int(seconds // 3600)} hours ago"
        )


    return (
        f"{int(seconds // 86400)} days ago"
    )


# ============================================================
# HEALTH CHECK
# ============================================================

@app.get("/api/health")
def health():

    return jsonify({
        "ok": True
    })


# ============================================================
# SYSTEM STATUS
# ============================================================

@app.get("/api/status")
def status():

    return jsonify({

        # ESP32-CAM status
        "esp32_online":
            store.is_role_online(
                "camera",
                within_seconds=90
            ),

        # ESP32 pump-controller status
        "pump_online":
            store.is_role_online(
                "pump"
            ),

        # Last pump runs
        "last_dispensed":
            humanize(
                store.get_last_dispensed(1)
            ),

        "pump1_last_dispensed":
            humanize(
                store.get_last_dispensed(1)
            ),

        "pump2_last_dispensed":
            humanize(
                store.get_last_dispensed(2)
            ),

        # Number of detections today
        "detections_today":
            store.get_today_count(),

        # Automatic spraying switched on/off from the dashboard
        "auto_mode":
            auto_mode_enabled(),
    })


# ============================================================
# DETECTION HISTORY
# ============================================================

@app.get("/api/history")
def history():

    limit = request.args.get(
        "limit",
        default=100,
        type=int
    )


    records = store.get_history(
        limit
    )


    for record in records:

        filename = record.pop(
            "image_filename",
            None
        )


        record["image_url"] = (
            image_url(filename)
        )


    return jsonify(
        records
    )


@app.delete("/api/history")
def clear_history():

    filenames = (
        store.clear_history()
    )


    remove_history_images(
        filenames
    )


    return jsonify({
        "cleared": True,
        "deleted_images": len(filenames)
    })


# ============================================================
# LATEST CAMERA CAPTURE
# ============================================================

@app.get("/api/camera/preview")
def camera_preview():
    """
    Returns the most recent camera capture.

    This is NOT a live video stream.
    It simply exposes the latest uploaded image.
    """

    capture = (
        store.get_latest_camera_capture()
    )


    if capture is None:

        return jsonify(None)


    filename = capture.pop(
        "image_filename",
        None
    )


    capture["image_url"] = (
        image_url(filename)
    )


    capture["live"] = False


    return jsonify(
        capture
    )


# ============================================================
# CAMERA -> SERVER -> ML MODEL
# ============================================================

@app.post("/api/predict")
def api_predict():

    # --------------------------------------------------------
    # 1. Make sure an image was uploaded
    # --------------------------------------------------------

    if "image" not in request.files:

        return jsonify({
            "error":
                "No image file under field name 'image'"
        }), 400


    image_file = (
        request.files["image"]
    )


    image_bytes = (
        image_file.read()
    )


    if not image_bytes:

        return jsonify({
            "error":
                "Uploaded image is empty"
        }), 400


    # --------------------------------------------------------
    # 2. Run ML inference
    # --------------------------------------------------------

    try:

        class_name, confidence = (
            predict(
                image_bytes
            )
        )

    except Exception as exc:

        return jsonify({
            "error":
                f"Could not process image: {exc}"
        }), 400


    # --------------------------------------------------------
    # 3. Convert model result into application result
    # --------------------------------------------------------

    result = build_result(
        class_name,
        confidence
    )


    # --------------------------------------------------------
    # 4. Save image
    # --------------------------------------------------------

    saved_filename = (
        save_image(
            image_bytes
        )
    )


    # --------------------------------------------------------
    # 5. Identify whether this is an authorized camera
    # --------------------------------------------------------

    role_header = request.headers.get(
        "X-Device-Role"
    )

    sent_camera_role = (
        (role_header or "").strip().lower()
        == "camera"
    )

    key_ok = device_authorized(
        request
    )

    is_camera = (
        sent_camera_role
        and
        (
            key_ok
            or
            not REQUIRE_CAMERA_KEY
        )
    )


    # ========================================================
    # AUTOMATIC PUMP LOGIC
    # ========================================================
    #
    # Fungal:
    #     Pump 1
    #
    # Non-Fungal:
    #     Pump 2
    #
    # Healthy:
    #     No pump
    #
    # The pump is only queued when Auto Mode is ON, the photo
    # looks like a leaf, and the model is confident enough.
    #
    # ========================================================

    auto_dispense = False

    pump_number = None

    pump_skipped_reason = None

    green_ratio = leaf_green_ratio(
        image_bytes
    )

    auto_on = auto_mode_enabled()


    # Which pump would this result use?
    wanted_pump = {
        "fungal": 1,
        "non_fungal": 2,
    }.get(
        result["class"]
    )


    if not sent_camera_role:

        pump_skipped_reason = (
            "request had no 'X-Device-Role: camera' header "
            "(treated as a manual dashboard upload)"
        )

    elif not is_camera:

        pump_skipped_reason = (
            "camera X-Device-Key does not match "
            "DEVICE_API_KEY and REQUIRE_CAMERA_KEY is on"
        )

    elif wanted_pump is None:

        pump_skipped_reason = (
            "leaf is healthy, no pump needed"
        )

    elif not auto_on:

        pump_skipped_reason = (
            "Auto Mode is OFF (switch it on in the dashboard)"
        )

    elif green_ratio < LEAF_MIN_GREEN:

        pump_skipped_reason = (
            f"image does not look like a leaf "
            f"(leaf colour {green_ratio:.0%}, "
            f"needs {LEAF_MIN_GREEN:.0%})"
        )

    elif result["confidence"] < MIN_CONFIDENCE:

        pump_skipped_reason = (
            f"model confidence {result['confidence']:.0%} "
            f"is below {MIN_CONFIDENCE:.0%}"
        )

    else:

        pump_number = wanted_pump

        store.queue_dispense(
            pump_number
        )

        auto_dispense = True


    print(
        "[predict]"
        f" role={role_header!r}"
        f" key_sent={bool(request.headers.get('X-Device-Key'))}"
        f" server_key_set={bool(DEVICE_API_KEY)}"
        f" key_ok={key_ok}"
        f" require_key={REQUIRE_CAMERA_KEY}"
        f" is_camera={is_camera}"
        f" auto_mode={auto_on}"
        f" leaf_colour={green_ratio:.2f}"
        f" class={result['class']}"
        f" confidence={result['confidence']}"
        f" pump={pump_number}"
        f" skipped={pump_skipped_reason!r}",
        flush=True
    )

    if sent_camera_role and not key_ok:

        print(
            "[predict] WARNING: the camera sent a key that does not "
            "match DEVICE_API_KEY. It was accepted because "
            "REQUIRE_CAMERA_KEY is off. Put the pump's DEVICE_KEY "
            "into the camera sketch to fix this.",
            flush=True
        )


    # --------------------------------------------------------
    # 6. Save detection history
    # --------------------------------------------------------

    removed_filenames = (
        store.log_detection(
            result["class"],
            result["confidence"],
            result["severity"],
            dispensed=auto_dispense,
            image_filename=saved_filename,
            is_camera=is_camera,
        )
    )


    # Remove images deleted by history retention
    remove_history_images(
        removed_filenames
    )


    # --------------------------------------------------------
    # 7. Update camera heartbeat
    # --------------------------------------------------------

    if is_camera:

        camera_device_id = (
            request.headers.get(
                "X-Device-Id",
                "esp32-cam"
            )
        )


        store.device_heartbeat(
            camera_device_id,
            "camera"
        )


    # --------------------------------------------------------
    # 8. Return diagnosis to ESP32-CAM
    # --------------------------------------------------------

    result["auto_dispense_queued"] = (
        auto_dispense
    )


    result["pump"] = (
        pump_number
    )


    result["pump_skipped_reason"] = (
        pump_skipped_reason
    )


    result["auto_mode"] = (
        auto_on
    )


    result["leaf_colour_ratio"] = round(
        green_ratio,
        3
    )


    result["image_url"] = (
        image_url(
            saved_filename
        )
    )


    return jsonify(
        result
    )


# ============================================================
# AUTO MODE (automatic spraying ON / OFF)
# ============================================================

@app.get("/api/auto-mode")
def get_auto_mode():

    return jsonify({
        "enabled": auto_mode_enabled()
    })


@app.post("/api/auto-mode")
def update_auto_mode():
    """
    Switch automatic spraying on or off.

    JSON:
        {"enabled": true}

    or:

        {"enabled": false}
    """

    data = (
        request.get_json(
            silent=True
        )
        or {}
    )


    enabled = data.get(
        "enabled"
    )


    if not isinstance(enabled, bool):

        return jsonify({
            "error":
                "send JSON like {\"enabled\": true}"
        }), 400


    set_auto_mode(
        enabled
    )


    print(
        f"[auto-mode] switched {'ON' if enabled else 'OFF'}",
        flush=True
    )


    return jsonify({
        "enabled": auto_mode_enabled()
    })


# ============================================================
# MANUAL PUMP TEST / MANUAL DISPENSE
# ============================================================

@app.post("/api/dispense")
def api_dispense():
    """
    Manually queue either pump.

    Used by the Pump Test page.

    JSON:
        {"pump": 1}

    or:

        {"pump": 2}
    """

    # --------------------------------------------------------
    # Read JSON body
    # --------------------------------------------------------

    data = (
        request.get_json(
            silent=True
        )
        or {}
    )


    pump = data.get(
        "pump",
        1
    )


    # --------------------------------------------------------
    # Validate pump number
    # --------------------------------------------------------

    if pump not in (1, 2):

        return jsonify({
            "error":
                "pump must be 1 or 2"
        }), 400


    # --------------------------------------------------------
    # Queue selected pump
    # --------------------------------------------------------

    store.queue_dispense(
        pump
    )


    return jsonify({

        "queued": True,

        "pump": pump
    })


# ============================================================
# PUMP COMMAND
# ============================================================

@app.get("/api/pump/command")
def pump_command():
    """
    Called by the ESP32 pump controller.

    Returns both pump commands and clears them from the queue.

    Example:

        {
            "pump1": "dispense",
            "pump2": "none"
        }
    """

    # --------------------------------------------------------
    # Authenticate pump controller
    # --------------------------------------------------------

    if not device_authorized(
        request
    ):

        return jsonify({
            "error":
                "unauthorized"
        }), 401


    # --------------------------------------------------------
    # Mark pump controller online
    #
    # Every successful poll updates last_seen.
    # --------------------------------------------------------

    pump_device_id = (
        request.headers.get(
            "X-Device-Id",
            "esp32-pump"
        )
    )


    store.device_heartbeat(
        pump_device_id,
        "pump"
    )


    # --------------------------------------------------------
    # Get and clear queued commands
    # --------------------------------------------------------

    commands = (
        store.get_and_clear_commands()
    )


    return jsonify({

        "pump1":
            commands[1]
            or "none",

        "pump2":
            commands[2]
            or "none"
    })


# ============================================================
# PUMP ACKNOWLEDGEMENT
# ============================================================

@app.post("/api/pump/ack")
def pump_ack():
    """
    Called by ESP32 after it finishes a pump run.
    """

    # --------------------------------------------------------
    # Authenticate pump controller
    # --------------------------------------------------------

    if not device_authorized(
        request
    ):

        return jsonify({
            "error":
                "unauthorized"
        }), 401


    # --------------------------------------------------------
    # Read request
    # --------------------------------------------------------

    data = (
        request.get_json(
            silent=True
        )
        or {}
    )


    pump = data.get(
        "pump",
        1
    )


    # --------------------------------------------------------
    # Validate pump number
    # --------------------------------------------------------

    if pump not in (1, 2):

        return jsonify({
            "error":
                "pump must be 1 or 2"
        }), 400


    # --------------------------------------------------------
    # Record last dispensing time
    # --------------------------------------------------------

    store.ack_dispense(
        pump
    )


    return jsonify({
        "ok": True
    })


# ============================================================
# DEVICE HEARTBEAT
# ============================================================

@app.post("/api/device/heartbeat")
def device_heartbeat():
    """
    Generic heartbeat endpoint.

    Used by ESP32-CAM.
    """

    if not device_authorized(
        request
    ):

        return jsonify({
            "error":
                "unauthorized"
        }), 401


    data = (
        request.get_json(
            silent=True
        )
        or {}
    )


    device_id = data.get(
        "device_id",
        "unknown"
    )


    role = data.get(
        "role",
        "unknown"
    )


    store.device_heartbeat(
        device_id,
        role
    )


    return jsonify({
        "ok": True
    })


# ============================================================
# STORED IMAGES
# ============================================================

@app.get("/api/uploads/<path:filename>")
def uploaded_image(filename):

    return send_from_directory(
        UPLOAD_DIR,
        filename
    )


# ============================================================
# LOCAL DEVELOPMENT
# ============================================================

if __name__ == "__main__":

    app.run(
        host="0.0.0.0",
        port=int(
            os.environ.get(
                "PORT",
                5000
            )
        ),
        debug=True
    )