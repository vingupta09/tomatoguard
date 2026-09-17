# TomatoGuard — model integration & deployment guide

This covers: wiring the trained model into the backend, deploying both
backend and frontend to Render, and flashing the two ESP32 boards.

## 1. What's in this zip

```
backend/            Flask API that serves the model
  app.py             routes
  inference.py        loads the TFLite model, runs predictions
  disease_info.py      category/symptoms/remedy copy per class
  store.py             SQLite history + device online-status + pump queue
  model/
    tomato_mobilenetv3.tflite   converted from your uploaded Keras model
    class_names.json             ["Fungal", "Healthy", "Non_Fungal"]
  requirements.txt
  runtime.txt
  .env.example

frontend/            The React dashboard (already styled)
firmware/
  esp32cam_capture/            ESP32-CAM: captures + uploads leaf photos
  esp32_pump_controller/       plain ESP32: polls for dispense commands, drives relay

render.yaml           one-click Render blueprint for both services
```

### Why the model was converted to TFLite

Your uploaded file was a Keras 3 model (`.keras` format, ~8.7MB). Running it
directly would need the full `tensorflow` package, which is several hundred
MB and typically needs 300-400MB+ of RAM just to import — tight against
Render's free-tier 512MB limit. I converted it to TFLite (`tomato_mobilenetv3.tflite`,
~1MB) and confirmed it produces the same predictions as the original Keras
model. The backend loads it with `ai-edge-litert`, a ~50MB interpreter-only
package — much safer for the free tier, and faster to cold-start.

The model expects raw 0-255 pixel values resized to 160x160 — it has its own
built-in rescaling layer (MobileNetV3's `include_preprocessing=True`), so
`inference.py` does **not** divide by 255. If you ever retrain and re-export,
keep that behavior, or update `inference.py` if you change it.

## 2. Run the backend locally first

```bash
cd backend
python3 -m venv venv
source venv/bin/activate        # venv\Scripts\activate on Windows
pip install -r requirements.txt
python app.py
```

It starts on `http://localhost:5000`. Quick check:

```bash
curl http://localhost:5000/api/health
curl -F "image=@/path/to/a/leaf.jpg" http://localhost:5000/api/predict
```

You should get back JSON with `category`, `disease`, `confidence`,
`severity`, `symptoms`, `remedy`, etc.

## 3. Point the frontend at it

In `frontend/`, create `.env`:

```
VITE_API_URL=http://localhost:5000
```

Then `npm install && npm run dev`, open the dashboard, and try uploading a
leaf photo — it now hits your real model instead of the demo fallback.

## 4. Deploy to Render

### Option A — one-click with the blueprint

1. Push this whole folder to a GitHub repo.
2. In Render: **New > Blueprint**, point it at the repo. Render reads
   `render.yaml` and creates both services.
3. Render auto-generates `DEVICE_API_KEY` for you (blueprint has
   `generateValue: true`) — copy it from the backend service's
   **Environment** tab, you'll need it for both ESP32 sketches.
4. After the frontend deploys, copy its URL and update the backend's
   `CORS_ORIGINS` env var to match exactly (Render dashboard > backend
   service > Environment), then update the frontend's `VITE_API_URL` to
   match the backend's URL if it differs from what's in `render.yaml`, and
   redeploy the frontend so the build picks it up (Vite env vars are baked
   in at build time, not read at runtime).

### Option B — manual, two services

**Backend (Web Service):**
- New > Web Service, connect the repo, set **Root Directory** to `backend`.
- Runtime: Python 3. Build command: `pip install -r requirements.txt`.
  Start command: `gunicorn -w 1 --threads 4 -b 0.0.0.0:$PORT app:app`.
- Environment variables:
  - `DEVICE_API_KEY` — any long random string (this is what the ESP32
    boards must send back to be trusted).
  - `CORS_ORIGINS` — the frontend's Render URL, e.g.
    `https://tomatoguard-frontend.onrender.com` (comma-separate more than
    one if needed, e.g. to also allow `http://localhost:5173` for local
    dev against the deployed API).
- Deploy. Note the resulting URL, e.g. `https://tomatoguard-api.onrender.com`.

**Frontend (Static Site):**
- New > Static Site, same repo, **Root Directory** `frontend`.
- Build command: `npm install && npm run build`. Publish directory: `dist`.
- Environment variable: `VITE_API_URL` = the backend URL from above.
- Add a rewrite rule so client-side routing works on refresh: **Redirects/Rewrites**
  → source `/*`, destination `/index.html`, type `Rewrite`.
- Deploy.

### Free-tier notes

- Free web services spin down after ~15 minutes idle. The **first** request
  after that (e.g. the ESP32-CAM's next capture, or you opening the
  dashboard) takes 30-60s to wake up — normal, not a bug.
- `store.py` uses a SQLite file on local disk. Render's free tier has an
  **ephemeral** filesystem — history resets on every redeploy/restart. Fine
  for a demo/project; if you need it to persist, add a Render persistent
  disk (paid) or point `store.py` at an external DB later.
- The backend runs with one gunicorn worker so the in-process pump-command
  queue and SQLite writes stay simple/consistent. That's plenty for a
  single-camera, single-pump setup.

## 5. Flash the ESP32 boards

Both sketches are in `firmware/`. In each `.ino`, fill in:

```cpp
const char* WIFI_SSID      = "...";
const char* WIFI_PASSWORD  = "...";
const char* SERVER_URL     = "https://tomatoguard-api.onrender.com"; // your backend URL, no trailing slash
const char* DEVICE_KEY     = "..."; // must match DEVICE_API_KEY on the backend
```

**esp32cam_capture** (AI-Thinker ESP32-CAM): install the `esp32` board
package and the `ArduinoJson` library in the Arduino IDE, select "AI Thinker
ESP32-CAM" as the board, flash with an FTDI adapter (GPIO0 → GND during
flashing, then disconnect and reset to run). It captures a photo every 20s
and POSTs it to `/api/predict` with `X-Device-Role: camera` — the backend
only auto-queues the pump for requests carrying that header + a valid
`X-Device-Key`, so a manual browser upload from the dashboard never
triggers hardware by accident.

**esp32_pump_controller** (any ESP32 dev board + relay module wired to your
pump/sprayer): install `ArduinoJson`, flash normally over USB. It polls
`/api/pump/command` every 5s; when the backend has a queued command (from
the camera's auto-dispense, or from the dashboard's manual "Dispense
pesticide now" button), it drives the relay for 4s and posts an ack.

## 6. The full loop, end to end

1. `esp32cam_capture` takes a photo, POSTs to `/api/predict` with
   `X-Device-Role: camera`.
2. The backend runs the TFLite model, builds a diagnosis, logs it to
   history, and — if severity is `medium` or `high` — queues a `dispense`
   command.
3. `esp32_pump_controller` polls `/api/pump/command`, sees `dispense`,
   drives the relay, and posts `/api/pump/ack`.
4. The dashboard (`GET /api/status`, `/api/history`) shows both devices as
   online, the latest detection, and the updated "last dispensed" time.
5. A person can also skip the hardware loop entirely and upload a photo
   from the dashboard — that always shows the diagnosis, but only queues
   the pump if they click "Dispense pesticide now" themselves.
