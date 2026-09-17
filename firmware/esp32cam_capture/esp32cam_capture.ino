/*
  ESP32-CAM leaf capture -> upload
  Board: AI-Thinker ESP32-CAM (the common $6-8 module with OV2640 camera)

  What this does, on a loop:
    1. Captures a JPEG frame from the camera.
    2. POSTs it as multipart/form-data to POST {SERVER_URL}/api/predict
       with field name "image", plus headers identifying this device as
       the camera so the server is allowed to auto-queue a pump command.
    3. Prints the JSON diagnosis to Serial for debugging.

  Libraries needed (Arduino IDE > Library Manager):
    - ArduinoJson (by Benoit Blanchon)
  Board support needed (Boards Manager):
    - "esp32" by Espressif Systems — select "AI Thinker ESP32-CAM" as the board.

  Wiring note: the AI-Thinker board has no onboard USB-serial chip. Use an
  FTDI/USB-serial adapter to flash it (GPIO0 to GND while resetting to enter
  flash mode), then remove that GPIO0-GND link and reset again to run.
*/

#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include "esp_camera.h"

// ---------- Configuration ----------
const char* WIFI_SSID      = "YOUR_WIFI_SSID";
const char* WIFI_PASSWORD  = "YOUR_WIFI_PASSWORD";

// Your deployed backend, e.g. "https://tomatoguard-api.onrender.com"
// No trailing slash.
const char* SERVER_URL     = "https://YOUR-BACKEND.onrender.com";

// Must match DEVICE_API_KEY set in the backend's environment variables.
const char* DEVICE_KEY     = "change-me-to-a-long-random-string";
const char* DEVICE_ID      = "esp32-cam-north-row";

// How often to capture + upload a frame.
const unsigned long CAPTURE_INTERVAL_MS = 20000; // 20s — stay under the
                                                   // server's 30s "online" window

// ---------- AI-Thinker ESP32-CAM pin map ----------
#define PWDN_GPIO_NUM     32
#define RESET_GPIO_NUM    -1
#define XCLK_GPIO_NUM      0
#define SIOD_GPIO_NUM     26
#define SIOC_GPIO_NUM     27
#define Y9_GPIO_NUM       35
#define Y8_GPIO_NUM       34
#define Y7_GPIO_NUM       39
#define Y6_GPIO_NUM       36
#define Y5_GPIO_NUM       21
#define Y4_GPIO_NUM       19
#define Y3_GPIO_NUM       18
#define Y2_GPIO_NUM        5
#define VSYNC_GPIO_NUM    25
#define HREF_GPIO_NUM     23
#define PCLK_GPIO_NUM     22

unsigned long lastCapture = 0;

void connectWiFi() {
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.print("Connecting to WiFi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(400);
    Serial.print(".");
  }
  Serial.println();
  Serial.print("WiFi connected, IP: ");
  Serial.println(WiFi.localIP());
}

bool initCamera() {
  camera_config_t config;
  config.ledc_channel = LEDC_CHANNEL_0;
  config.ledc_timer   = LEDC_TIMER_0;
  config.pin_d0 = Y2_GPIO_NUM;
  config.pin_d1 = Y3_GPIO_NUM;
  config.pin_d2 = Y4_GPIO_NUM;
  config.pin_d3 = Y5_GPIO_NUM;
  config.pin_d4 = Y6_GPIO_NUM;
  config.pin_d5 = Y7_GPIO_NUM;
  config.pin_d6 = Y8_GPIO_NUM;
  config.pin_d7 = Y9_GPIO_NUM;
  config.pin_xclk = XCLK_GPIO_NUM;
  config.pin_pclk = PCLK_GPIO_NUM;
  config.pin_vsync = VSYNC_GPIO_NUM;
  config.pin_href = HREF_GPIO_NUM;
  config.pin_sscb_sda = SIOD_GPIO_NUM;
  config.pin_sscb_scl = SIOC_GPIO_NUM;
  config.pin_pwdn = PWDN_GPIO_NUM;
  config.pin_reset = RESET_GPIO_NUM;
  config.xclk_freq_hz = 20000000;
  config.pixel_format = PIXFORMAT_JPEG;

  // Leaf photos don't need to be huge — SVGA keeps upload time and
  // server-side memory use low. Bump to UXGA if you want more detail.
  if (psramFound()) {
    config.frame_size = FRAMESIZE_SVGA;   // 800x600
    config.jpeg_quality = 10;             // lower number = higher quality
    config.fb_count = 2;
  } else {
    config.frame_size = FRAMESIZE_VGA;    // 640x480
    config.jpeg_quality = 12;
    config.fb_count = 1;
  }

  esp_err_t err = esp_camera_init(&config);
  if (err != ESP_OK) {
    Serial.printf("Camera init failed with error 0x%x\n", err);
    return false;
  }
  return true;
}

// Uploads one JPEG frame as multipart/form-data and returns true on a
// successful (2xx) response. Prints the diagnosis JSON to Serial.
bool captureAndUpload() {
  camera_fb_t* fb = esp_camera_fb_get();
  if (!fb) {
    Serial.println("Camera capture failed");
    return false;
  }

  HTTPClient http;
  String url = String(SERVER_URL) + "/api/predict";
  http.begin(url);

  String boundary = "TomatoGuardBoundary7331";
  http.addHeader("Content-Type", "multipart/form-data; boundary=" + boundary);
  http.addHeader("X-Device-Role", "camera");
  http.addHeader("X-Device-Id", DEVICE_ID);
  http.addHeader("X-Device-Key", DEVICE_KEY);

  String head = "--" + boundary + "\r\n"
                "Content-Disposition: form-data; name=\"image\"; filename=\"leaf.jpg\"\r\n"
                "Content-Type: image/jpeg\r\n\r\n";
  String tail = "\r\n--" + boundary + "--\r\n";

  size_t totalLen = head.length() + fb->len + tail.length();
  uint8_t* body = (uint8_t*)malloc(totalLen);
  if (!body) {
    Serial.println("Not enough memory to build request body");
    esp_camera_fb_return(fb);
    http.end();
    return false;
  }

  size_t idx = 0;
  memcpy(body + idx, head.c_str(), head.length()); idx += head.length();
  memcpy(body + idx, fb->buf, fb->len);             idx += fb->len;
  memcpy(body + idx, tail.c_str(), tail.length());  idx += tail.length();

  int status = http.POST(body, totalLen);
  free(body);
  esp_camera_fb_return(fb);

  if (status > 0) {
    String response = http.getString();
    Serial.printf("Server responded %d: %s\n", status, response.c_str());

    StaticJsonDocument<1024> doc;
    if (deserializeJson(doc, response) == DeserializationError::Ok) {
      const char* disease = doc["disease"] | "unknown";
      const char* severity = doc["severity"] | "unknown";
      bool queued = doc["auto_dispense_queued"] | false;
      Serial.printf("Diagnosis: %s (severity: %s) — pump queued: %s\n",
                     disease, severity, queued ? "yes" : "no");
    }
  } else {
    Serial.printf("HTTP POST failed: %s\n", http.errorToString(status).c_str());
  }

  http.end();
  return status >= 200 && status < 300;
}

void setup() {
  Serial.begin(115200);
  delay(200);

  if (!initCamera()) {
    Serial.println("Halting — camera init failed. Check wiring/board select.");
    while (true) delay(1000);
  }
  connectWiFi();
}

void loop() {
  if (WiFi.status() != WL_CONNECTED) {
    connectWiFi();
  }

  if (millis() - lastCapture >= CAPTURE_INTERVAL_MS) {
    lastCapture = millis();
    captureAndUpload();
  }
}
