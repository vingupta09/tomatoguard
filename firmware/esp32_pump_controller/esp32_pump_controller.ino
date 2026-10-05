/*
  ESP32 Pump Controller - ACTIVE-LOW RELAYS

  Relay logic:
    LOW  = Relay ON  = Pump ON
    HIGH = Relay OFF = Pump OFF

  Controls two independently-controlled pumps/sprayers.

  Flow:
    1. GET /api/pump/command every POLL_INTERVAL_MS
    2. If pump1/pump2 says "dispense":
       - Relay goes LOW (ON)
       - Pump runs for DISPENSE_DURATION_MS
       - Relay goes HIGH (OFF)
    3. POST /api/pump/ack after dispensing

  IMPORTANT:
    Do NOT drive a pump directly from an ESP32 GPIO.
    Use a properly-rated relay module and appropriate external
    power supply for the pump.
*/

#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

// ---------- WiFi Configuration ----------
const char* WIFI_SSID     = "Excitel_ 2.4";
const char* WIFI_PASSWORD = "@Udit1588";

// ---------- Server Configuration ----------
const char* SERVER_URL =
    "https://tomatoguard-api.onrender.com";

// Must match DEVICE_API_KEY in your backend
const char* DEVICE_KEY =
    "tg-secret-8f92x71k";

const char* DEVICE_ID =
    "esp32-pump-north-row";

// ---------- Relay Pins ----------
const int RELAY_PIN_1 = 26;   // Pump 1 - pesticide/sprayer
const int RELAY_PIN_2 = 27;   // Pump 2 - water pump

// ---------- Timing ----------
const unsigned long POLL_INTERVAL_MS = 2000;
const unsigned long DISPENSE_DURATION_MS = 4000;

unsigned long lastPoll = 0;


// ============================================================
// RELAY CONTROL
// ============================================================

// Active-LOW relay:
// LOW  = ON
// HIGH = OFF

void relayOn(int relayPin) {
  digitalWrite(relayPin, LOW);
}

void relayOff(int relayPin) {
  digitalWrite(relayPin, HIGH);
}


// ============================================================
// WIFI CONNECTION
// ============================================================

void connectWiFi() {

  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  Serial.print("Connecting to WiFi");

  while (WiFi.status() != WL_CONNECTED) {
    delay(400);
    Serial.print(".");
  }

  Serial.println();
  Serial.println("WiFi connected!");

  Serial.print("IP address: ");
  Serial.println(WiFi.localIP());
}


// ============================================================
// DISPENSE
// ============================================================

void dispense(int pumpNum, int relayPin) {

  Serial.printf("Dispensing pump %d...\n", pumpNum);

  // ACTIVE-LOW RELAY:
  // LOW turns relay ON
  relayOn(relayPin);

  Serial.printf(
    "Pump %d ON for %lu ms\n",
    pumpNum,
    DISPENSE_DURATION_MS
  );

  delay(DISPENSE_DURATION_MS);

  // ACTIVE-LOW RELAY:
  // HIGH turns relay OFF
  relayOff(relayPin);

  Serial.printf("Pump %d OFF\n", pumpNum);

  Serial.println("Done. Sending ack...");

  // ----------------------------------------------------------
  // Send ACK to server
  // ----------------------------------------------------------

  HTTPClient http;

  String ackURL =
      String(SERVER_URL) + "/api/pump/ack";

  http.begin(ackURL);

  http.addHeader(
      "X-Device-Key",
      DEVICE_KEY
  );

  http.addHeader(
      "Content-Type",
      "application/json"
  );

  String payload =
      String("{\"pump\":") +
      pumpNum +
      "}";

  int status = http.POST(payload);

  Serial.printf(
      "ACK responded: %d\n",
      status
  );

  if (status > 0) {
    String response = http.getString();

    Serial.print("ACK response: ");
    Serial.println(response);
  }

  http.end();
}


// ============================================================
// POLL SERVER FOR COMMANDS
// ============================================================

void pollForCommand() {

  HTTPClient http;

  String url =
      String(SERVER_URL) +
      "/api/pump/command";

  http.begin(url);

  http.addHeader(
      "X-Device-Key",
      DEVICE_KEY
  );

  http.addHeader(
      "X-Device-Id",
      DEVICE_ID
  );

  Serial.println("Checking server for pump commands...");

  int status = http.GET();

  if (status > 0) {

    Serial.printf(
        "Server responded: %d\n",
        status
    );

    String response =
        http.getString();

    Serial.print("Server response: ");
    Serial.println(response);

    StaticJsonDocument<256> doc;

    DeserializationError error =
        deserializeJson(doc, response);

    if (error == DeserializationError::Ok) {

      const char* pump1 =
          doc["pump1"] | "none";

      const char* pump2 =
          doc["pump2"] | "none";

      Serial.print("Pump 1 command: ");
      Serial.println(pump1);

      Serial.print("Pump 2 command: ");
      Serial.println(pump2);


      // ------------------------------------------------------
      // PUMP 1
      // ------------------------------------------------------

      if (strcmp(pump1, "dispense") == 0) {

        dispense(
            1,
            RELAY_PIN_1
        );
      }


      // ------------------------------------------------------
      // PUMP 2
      // ------------------------------------------------------

      if (strcmp(pump2, "dispense") == 0) {

        dispense(
            2,
            RELAY_PIN_2
        );
      }

    } else {

      Serial.print(
          "JSON parsing failed: "
      );

      Serial.println(
          error.c_str()
      );
    }

  } else {

    Serial.printf(
        "Poll failed: %s\n",
        http.errorToString(status).c_str()
    );
  }

  http.end();
}


// ============================================================
// SETUP
// ============================================================

void setup() {

  Serial.begin(115200);

  Serial.println();
  Serial.println("==============================");
  Serial.println("ESP32 Pump Controller");
  Serial.println("ACTIVE-LOW RELAY MODE");
  Serial.println("==============================");


  // ----------------------------------------------------------
  // Configure relay pins
  // ----------------------------------------------------------

  pinMode(
      RELAY_PIN_1,
      OUTPUT
  );

  pinMode(
      RELAY_PIN_2,
      OUTPUT
  );


  // ----------------------------------------------------------
  // IMPORTANT:
  // Active-LOW relay:
  // HIGH = OFF
  //
  // Set HIGH immediately so pumps are OFF.
  // ----------------------------------------------------------

  digitalWrite(
      RELAY_PIN_1,
      HIGH
  );

  digitalWrite(
      RELAY_PIN_2,
      HIGH
  );

  Serial.println("Pump 1 relay: OFF");
  Serial.println("Pump 2 relay: OFF");


  // ----------------------------------------------------------
  // Connect WiFi
  // ----------------------------------------------------------

  connectWiFi();
}


// ============================================================
// LOOP
// ============================================================

void loop() {

  // ----------------------------------------------------------
  // Reconnect WiFi if connection is lost
  // ----------------------------------------------------------

  if (WiFi.status() != WL_CONNECTED) {

    Serial.println(
        "WiFi disconnected. Reconnecting..."
    );

    // Make sure pumps are OFF during reconnection
    relayOff(RELAY_PIN_1);
    relayOff(RELAY_PIN_2);

    connectWiFi();
  }


  // ----------------------------------------------------------
  // Poll server
  // ----------------------------------------------------------

  if (
      millis() - lastPoll >=
      POLL_INTERVAL_MS
  ) {

    lastPoll = millis();

    pollForCommand();
  }
}