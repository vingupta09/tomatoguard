/*
  ESP32 pump controller
  Board: any plain ESP32 dev board (does not need a camera).
  Drives two independently-controlled pumps/sprayers (e.g. pesticide + water).

  What this does, on a loop:
    1. GETs {SERVER_URL}/api/pump/command every POLL_INTERVAL_MS, which
       returns the pending command for each pump: {"pump1": "dispense"|"none",
       "pump2": "dispense"|"none"}.
    2. For each pump with a pending "dispense", drives that pump's relay pin
       HIGH for DISPENSE_DURATION_MS, then LOW.
    3. POSTs {SERVER_URL}/api/pump/ack with {"pump": 1|2} after each one, so
       the dashboard's "Last dispensed" status updates.

  Wiring: relay module IN pin -> RELAY_PIN_1 / RELAY_PIN_2, relay VCC/GND ->
  5V/GND, pump/solenoid wired through the relay's NO (normally open) contact
  so it only runs while its pin is driven HIGH. Use a relay module rated for
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

// Adjust these two to whatever GPIOs your relay modules are actually wired to.
const int RELAY_PIN_1                  = 26; // pump 1, e.g. pesticide sprayer
const int RELAY_PIN_2                  = 27; // pump 2, e.g. water pump
const unsigned long POLL_INTERVAL_MS   = 5000;   // check for commands every 5s
const unsigned long DISPENSE_DURATION_MS = 4000; // how long a pump runs per dose

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

void dispense(int pumpNum, int relayPin) {
  Serial.printf("Dispensing pump %d...\n", pumpNum);
  digitalWrite(relayPin, HIGH);
  delay(DISPENSE_DURATION_MS);
  digitalWrite(relayPin, LOW);
  Serial.println("Done. Sending ack.");

  HTTPClient http;
  http.begin(String(SERVER_URL) + "/api/pump/ack");
  http.addHeader("X-Device-Key", DEVICE_KEY);
  http.addHeader("Content-Type", "application/json");
  int status = http.POST(String("{\"pump\":") + pumpNum + "}");
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
      const char* pump1 = doc["pump1"] | "none";
      const char* pump2 = doc["pump2"] | "none";
      if (strcmp(pump1, "dispense") == 0) {
        dispense(1, RELAY_PIN_1);
      }
      if (strcmp(pump2, "dispense") == 0) {
        dispense(2, RELAY_PIN_2);
      }
    }
  } else {
    Serial.printf("Poll failed: %s\n", http.errorToString(status).c_str());
  }
  http.end();
}

void setup() {
  Serial.begin(115200);
  pinMode(RELAY_PIN_1, OUTPUT);
  pinMode(RELAY_PIN_2, OUTPUT);
  digitalWrite(RELAY_PIN_1, LOW);
  digitalWrite(RELAY_PIN_2, LOW);
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
