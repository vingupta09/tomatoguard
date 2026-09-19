# Firmware

Two Arduino sketches, each flashed to a separate ESP32 board:

| Sketch | Board | Job |
|---|---|---|
| `esp32_pump_controller/` | Any plain ESP32 dev board | Drives two relay-controlled pumps on command from the backend |
| `esp32cam_capture/` | AI-Thinker ESP32-CAM | Captures leaf photos and uploads them for diagnosis |

Both talk to the Flask backend in `backend/` over Wi-Fi — they never talk to
each other directly. See the repo-root `DEPLOY.md` for deploying that
backend; this file is about the two boards themselves.

## 1. One-time Arduino IDE setup

1. Install the [Arduino IDE](https://www.arduino.cc/en/software) (2.x).
2. **File > Preferences > Additional boards manager URLs**, add:
   `https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json`
3. **Tools > Board > Boards Manager**, search `esp32`, install "esp32 by
   Espressif Systems".
4. **Tools > Manage Libraries**, install **ArduinoJson** (by Benoit
   Blanchon) — both sketches need it.

## 2. `esp32_pump_controller` — the pump board

### What it does

Polls `GET {SERVER_URL}/api/pump/command` every 5 seconds. The backend
replies with which pump(s) have a command queued:

```json
{ "pump1": "dispense", "pump2": "none" }
```

For each pump that says `"dispense"`, the board drives that pump's relay
pin `HIGH` for `DISPENSE_DURATION_MS`, then `LOW`, then posts
`{SERVER_URL}/api/pump/ack` with `{"pump": 1}` (or `2`) so the dashboard's
"last dispensed" time updates.

A command gets queued either automatically (the camera board detects
medium/high-severity disease) or manually — from the dashboard's
**Dispense pesticide now** button, or from the **Pump test** tab, which
lets you fire pump 1 or pump 2 individually without needing a real
detection. That tab is exactly what you want for checking wiring after a
fresh flash.

### Wiring

You need **two** relay modules, one per pump:

```
ESP32 GPIO 26  ---> Relay 1 IN     Relay 1 VCC/GND ---> ESP32 5V/GND
ESP32 GPIO 27  ---> Relay 2 IN     Relay 2 VCC/GND ---> ESP32 5V/GND

Pump/solenoid 1 wired through Relay 1's NO (normally-open) contact,
in series with the pump's own power supply.
Pump/solenoid 2 wired the same way through Relay 2.
```

- Use a relay module rated for your pump's actual voltage/current. Never
  wire a pump directly to a GPIO pin — the relay is what isolates the
  ESP32's 3.3V logic from the pump's power circuit.
- If your pumps are on different GPIOs than 26/27, change `RELAY_PIN_1`
  and `RELAY_PIN_2` at the top of the sketch to match.
- Only one pump runs at a time even if both are triggered together — the
  board handles pump 1's full on/off cycle before starting pump 2.

### Configuration

Open `esp32_pump_controller.ino` and edit the block near the top:

```cpp
const char* WIFI_SSID      = "YOUR_WIFI_SSID";
const char* WIFI_PASSWORD  = "YOUR_WIFI_PASSWORD";
const char* SERVER_URL     = "https://YOUR-BACKEND.onrender.com"; // no trailing slash
const char* DEVICE_KEY     = "change-me-to-a-long-random-string";  // must match backend's DEVICE_API_KEY
const char* DEVICE_ID      = "esp32-pump-north-row";

const int RELAY_PIN_1 = 26; // pump 1
const int RELAY_PIN_2 = 27; // pump 2
```

`SERVER_URL` and `DEVICE_KEY` must match your deployed (or locally running)
backend — see `DEPLOY.md` for how the backend is configured and deployed.
For local testing against a backend running on your laptop, `SERVER_URL`
needs to be reachable from the ESP32 over your LAN (e.g.
`http://192.168.1.42:5000`, not `localhost`).

### Flashing

1. Connect the board over USB.
2. **Tools > Board**, pick your specific ESP32 dev board (or "ESP32 Dev
   Module" if unsure).
3. **Tools > Port**, select the board's serial port.
4. Click **Upload**.
5. Open **Tools > Serial Monitor** at 115200 baud — you should see it
   connect to Wi-Fi and print its IP address, then `Poll failed` or
   silence (silence is normal; it only logs when a pump actually fires).

### Testing it

1. Open the dashboard, log in, and go to the **Pump test** tab.
2. Click **Test Pump 1** — within ~5s (the poll interval) that pump's
   relay should click on, run for 4s, then click off.
3. Click **Test Pump 2** and confirm the other relay fires.
4. The tab's "last run" times and the pump-controller "Online" status
   should update after each test.

If nothing fires: check the Serial Monitor for Wi-Fi/HTTP errors first,
then confirm `DEVICE_KEY` matches the backend's `DEVICE_API_KEY` exactly
(a mismatch causes silent `401`s from `/api/pump/command`).

## 3. `esp32cam_capture` — the camera board

### What it does

Every 20 seconds, captures a JPEG and `POST`s it to `{SERVER_URL}/api/predict`
with headers identifying it as the camera device. If the backend classifies
the leaf as medium/high severity, it automatically queues pump 1's
dispense command — no button press needed.

### Wiring / hardware

AI-Thinker ESP32-CAM modules have no onboard USB-serial chip, so you flash
them with an external FTDI/USB-serial adapter:

1. Wire the adapter's TX/RX/5V/GND to the board's U0R/U0T/5V/GND.
2. Bridge **GPIO0 to GND** before powering on, to enter flash mode.
3. Flash (see below).
4. Remove the GPIO0-GND bridge and reset the board to run normally.

### Configuration

Same idea as the pump board — edit the top of `esp32cam_capture.ino`:

```cpp
const char* WIFI_SSID      = "YOUR_WIFI_SSID";
const char* WIFI_PASSWORD  = "YOUR_WIFI_PASSWORD";
const char* SERVER_URL     = "https://YOUR-BACKEND.onrender.com"; // no trailing slash
const char* DEVICE_KEY     = "change-me-to-a-long-random-string";  // must match backend's DEVICE_API_KEY
const char* DEVICE_ID      = "esp32-cam-north-row";
```

### Flashing

1. **Tools > Board**, select **AI Thinker ESP32-CAM**.
2. **Tools > Port**, select the FTDI adapter's port.
3. With GPIO0 bridged to GND, click **Upload**.
4. When it finishes, disconnect GPIO0 from GND and press the board's
   reset button.
5. Open **Serial Monitor** at 115200 baud — it should connect to Wi-Fi and
   then log a diagnosis every ~20 seconds.

### Testing it

Point the camera at a leaf (or anything) and watch Serial Monitor for
`Diagnosis: ... — pump queued: yes/no`. If severity comes back
medium/high, pump 1 should fire on the pump board's next poll (within 5s)
without you touching the dashboard.

## 4. Running both boards against a local backend

For development you don't need Render at all:

```bash
cd backend
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt
python app.py            # listens on 0.0.0.0:5000
```

Find your laptop's LAN IP (`ipconfig getifaddr en0` on macOS, `hostname -I`
on Linux) and set `SERVER_URL` in both sketches to
`http://<that-ip>:5000`. Both boards and your laptop need to be on the
same Wi-Fi network. Leave `DEVICE_KEY` blank on the backend
(`DEVICE_API_KEY` unset) to skip auth entirely while testing locally —
just remember to set a real one before deploying anywhere public.
