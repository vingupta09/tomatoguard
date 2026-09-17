/*
  ESP32 pump controller
  Board: any plain ESP32 dev board (does not need a camera).

  What this does, on a loop:
    1. GETs {SERVER_URL}/api/pump/command every POLL_INTERVAL_MS.
    2. If the server says "dispense", drives the relay pin HIGH for
       DISPENSE_DURATION_MS (running the pump/sprayer), then LOW.
    3. POSTs {SERVER_URL}/api/pump/ack so the dashboard's "Last dispensed"
       status updates.

  Wiring: relay module IN pin -> RELAY_PIN, relay VCC/GND -> 5V/GND,
  pump/solenoid wired through the relay's NO (normally open) contact so it
  only runs while RELAY_PIN is driven HIGH. Use a relay module rated for
  your pump's voltage/current — do not drive a pump directly from a GPIO pin.

  Libraries needed (Arduino IDE > Library Manager):
    - ArduinoJson (by Benoit Blanchon)
*/

#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

// ---------- Configuration ----------
const char* WIFI_SSID      = "YOUR_WIFI_SSID";
const char* WIFI_PASSWORD  = "YOUR_WIFI_PASSWORD";

// Your deployed backend, e.g. "https://tomatoguard-api.onrender.com"
const char* SERVER_URL     = "https://YOUR-BACKEND.onrender.com";

// Must match DEVICE_API_KEY set in the backend's environment variables.
const char* DEVICE_KEY     = "change-me-to-a-long-random-string";
const char* DEVICE_ID      = "esp32-pump-north-row";

const int RELAY_PIN                    = 26;
const unsigned long POLL_INTERVAL_MS   = 5000;   // check for commands every 5s
const unsigned long DISPENSE_DURATION_MS = 4000; // how long the pump runs per dose

unsigned long lastPoll = 0;

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

void dispense() {
  Serial.println("Dispensing...");
  digitalWrite(RELAY_PIN, HIGH);
  delay(DISPENSE_DURATION_MS);
  digitalWrite(RELAY_PIN, LOW);
  Serial.println("Done. Sending ack.");

  HTTPClient http;
  http.begin(String(SERVER_URL) + "/api/pump/ack");
  http.addHeader("X-Device-Key", DEVICE_KEY);
  http.addHeader("Content-Type", "application/json");
  int status = http.POST("{}");
  Serial.printf("ack responded %d\n", status);
  http.end();
}

void pollForCommand() {
  HTTPClient http;
  String url = String(SERVER_URL) + "/api/pump/command";
  http.begin(url);
  http.addHeader("X-Device-Key", DEVICE_KEY);
  http.addHeader("X-Device-Id", DEVICE_ID);

  int status = http.GET();
  if (status > 0) {
    String response = http.getString();
    StaticJsonDocument<256> doc;
    if (deserializeJson(doc, response) == DeserializationError::Ok) {
      const char* command = doc["command"] | "none";
      if (strcmp(command, "dispense") == 0) {
        dispense();
      }
    }
  } else {
    Serial.printf("Poll failed: %s\n", http.errorToString(status).c_str());
  }
  http.end();
}

void setup() {
  Serial.begin(115200);
  pinMode(RELAY_PIN, OUTPUT);
  digitalWrite(RELAY_PIN, LOW);
  connectWiFi();
}

void loop() {
  if (WiFi.status() != WL_CONNECTED) {
    connectWiFi();
  }

  if (millis() - lastPoll >= POLL_INTERVAL_MS) {
    lastPoll = millis();
    pollForCommand();
  }
}
