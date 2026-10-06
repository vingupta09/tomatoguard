import datetime
import os
import uuid

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
                "camera"
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

    is_camera = (
        request.headers.get(
            "X-Device-Role"
        ) == "camera"
        and
        device_authorized(
            request
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
    # ========================================================

    auto_dispense = False

    pump_number = None


    if is_camera:

        # ----------------------------------------------------
        # FUNGAL -> PUMP 1
        # ----------------------------------------------------

        if result["class"] == "fungal":

            pump_number = 1

            store.queue_dispense(
                1
            )

            auto_dispense = True


        # ----------------------------------------------------
        # NON-FUNGAL -> PUMP 2
        # ----------------------------------------------------

        elif result["class"] == "non_fungal":

            pump_number = 2

            store.queue_dispense(
                2
            )

            auto_dispense = True


        # ----------------------------------------------------
        # HEALTHY -> NO PUMP
        # ----------------------------------------------------

        else:

            auto_dispense = False

            pump_number = None


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


    result["image_url"] = (
        image_url(
            saved_filename
        )
    )


    return jsonify(
        result
    )


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