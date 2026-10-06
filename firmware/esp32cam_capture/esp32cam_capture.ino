#include <WiFi.h>
#include <HTTPClient.h>
#include "esp_camera.h"
#include "img_converters.h"

// =====================================================
// WiFi
// =====================================================
const char* ssid = "Excitel_ 2.4";
const char* password = "YOUR_WIFI_PASSWORD";

// =====================================================
// TomatoGuard API
// =====================================================
const char* serverURL =
    "https://tomatoguard-api.onrender.com/api/predict";

// IMPORTANT:
// Put the SAME device ID and device key that your backend expects.
const char* deviceId = "YOUR_DEVICE_ID";
const char* deviceKey = "YOUR_DEVICE_KEY";

// =====================================================
// AI THINKER ESP32-CAM PIN CONFIGURATION
// =====================================================
#define PWDN_GPIO_NUM     32
#define RESET_GPIO_NUM    -1
#define XCLK_GPIO_NUM      0
#define SIOD_GPIO_NUM      26
#define SIOC_GPIO_NUM      27

#define Y9_GPIO_NUM        35
#define Y8_GPIO_NUM        34
#define Y7_GPIO_NUM        39
#define Y6_GPIO_NUM        36
#define Y5_GPIO_NUM        21
#define Y4_GPIO_NUM        19
#define Y3_GPIO_NUM        18
#define Y2_GPIO_NUM        5

#define VSYNC_GPIO_NUM     25
#define HREF_GPIO_NUM      23
#define PCLK_GPIO_NUM      22


// =====================================================
// CONNECT WIFI
// =====================================================
bool connectWiFi() {

  if (WiFi.status() == WL_CONNECTED) {
    return true;
  }

  Serial.println();
  Serial.println("Connecting to WiFi...");

  WiFi.mode(WIFI_STA);

  // Normal WiFi transmit power
  WiFi.setTxPower(WIFI_POWER_19_5dBm);

  WiFi.begin(ssid, password);

  int attempts = 0;

  while (WiFi.status() != WL_CONNECTED && attempts < 30) {

    delay(500);

    Serial.print(".");

    attempts++;
  }

  Serial.println();

  if (WiFi.status() == WL_CONNECTED) {

    Serial.println("WiFi connected!");

    Serial.print("IP address: ");
    Serial.println(WiFi.localIP());

    Serial.print("RSSI: ");
    Serial.print(WiFi.RSSI());
    Serial.println(" dBm");

    return true;
  }

  Serial.println("WiFi connection FAILED!");

  return false;
}


// =====================================================
// CAMERA INITIALIZATION
// =====================================================
bool initCamera() {

  camera_config_t config;

  config.ledc_channel = LEDC_CHANNEL_0;
  config.ledc_timer = LEDC_TIMER_0;

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

  // IMPORTANT:
  // OV3660 works with RGB565 in our setup.
  config.pixel_format = PIXFORMAT_RGB565;

  // 320 x 240
  config.frame_size = FRAMESIZE_QVGA;

  config.jpeg_quality = 12;

  // Keep one framebuffer for stability.
  config.fb_count = 1;

  Serial.println();
  Serial.println("Initializing camera...");

  esp_err_t err = esp_camera_init(&config);

  if (err != ESP_OK) {

    Serial.print("Camera initialization FAILED. Error: 0x");
    Serial.println(err, HEX);

    return false;
  }

  Serial.println("Camera initialized successfully!");

  sensor_t* sensor = esp_camera_sensor_get();

  if (sensor != NULL) {

    Serial.print("Sensor PID: 0x");
    Serial.println(sensor->id.PID, HEX);
  }

  return true;
}


// =====================================================
// CAPTURE + CONVERT TO JPEG + UPLOAD
// =====================================================
void uploadImage() {

  // ---------------------------------------------------
  // Check WiFi
  // ---------------------------------------------------

  if (!connectWiFi()) {

    Serial.println("Upload skipped because WiFi is unavailable.");

    return;
  }


  // ---------------------------------------------------
  // Capture RGB565 image
  // ---------------------------------------------------

  Serial.println();
  Serial.println("======================================");
  Serial.println("Capturing image...");
  Serial.println("======================================");

  camera_fb_t* fb = esp_camera_fb_get();

  if (fb == NULL) {

    Serial.println("ERROR: Camera capture failed!");

    return;
  }

  Serial.print("RGB565 image: ");
  Serial.print(fb->width);
  Serial.print(" x ");
  Serial.print(fb->height);
  Serial.print(" | ");
  Serial.print(fb->len);
  Serial.println(" bytes");


  // ---------------------------------------------------
  // Convert RGB565 → JPEG
  // ---------------------------------------------------

  uint8_t* jpgBuf = NULL;

  size_t jpgLen = 0;

  bool converted = frame2jpg(
    fb,
    80,
    &jpgBuf,
    &jpgLen
  );


  // Camera framebuffer is no longer needed.
  esp_camera_fb_return(fb);

  if (!converted || jpgBuf == NULL) {

    Serial.println("ERROR: JPEG conversion failed!");

    return;
  }

  Serial.println("JPEG conversion SUCCESS!");

  Serial.print("JPEG size: ");
  Serial.print(jpgLen);
  Serial.println(" bytes");


  // ---------------------------------------------------
  // Create multipart/form-data
  // ---------------------------------------------------

  String boundary = "----ESP32CameraBoundary";

  String head =
      "--" + boundary + "\r\n"
      "Content-Disposition: form-data; name=\"image\"; filename=\"capture.jpg\"\r\n"
      "Content-Type: image/jpeg\r\n"
      "\r\n";

  String tail =
      "\r\n--" + boundary + "--\r\n";


  size_t totalLength =
      head.length() +
      jpgLen +
      tail.length();


  Serial.print("Multipart upload size: ");
  Serial.print(totalLength);
  Serial.println(" bytes");


  // ---------------------------------------------------
  // Allocate upload buffer
  // ---------------------------------------------------

  uint8_t* body = (uint8_t*)malloc(totalLength);

  if (body == NULL) {

    Serial.println("ERROR: Not enough memory for upload buffer!");

    free(jpgBuf);

    return;
  }


  // ---------------------------------------------------
  // Copy multipart header
  // ---------------------------------------------------

  size_t offset = 0;

  memcpy(
    body + offset,
    head.c_str(),
    head.length()
  );

  offset += head.length();


  // ---------------------------------------------------
  // Copy JPEG
  // ---------------------------------------------------

  memcpy(
    body + offset,
    jpgBuf,
    jpgLen
  );

  offset += jpgLen;


  // ---------------------------------------------------
  // Copy multipart ending
  // ---------------------------------------------------

  memcpy(
    body + offset,
    tail.c_str(),
    tail.length()
  );


  // ---------------------------------------------------
  // HTTP POST
  // ---------------------------------------------------

  HTTPClient http;

  Serial.println();
  Serial.println("Connecting to TomatoGuard API...");

  http.begin(serverURL);

  http.setTimeout(30000);


  // Content-Type
  String contentType =
      "multipart/form-data; boundary=" + boundary;

  http.addHeader(
    "Content-Type",
    contentType
  );


  // Device authentication headers
  http.addHeader(
    "X-Device-Role",
    "camera"
  );

  http.addHeader(
    "X-Device-Id",
    deviceId
  );

  http.addHeader(
    "X-Device-Key",
    deviceKey
  );


  Serial.println("Uploading JPEG...");

  int httpCode = http.POST(
    body,
    totalLength
  );


  // ---------------------------------------------------
  // Server response
  // ---------------------------------------------------

  Serial.print("HTTP response code: ");
  Serial.println(httpCode);


  if (httpCode > 0) {

    String response = http.getString();

    Serial.println();
    Serial.println("========== SERVER RESPONSE ==========");

    Serial.println(response);

    Serial.println("=====================================");

  } 
  else {

    Serial.print("HTTP POST failed: ");

    Serial.println(
      http.errorToString(httpCode)
    );
  }


  // ---------------------------------------------------
  // Cleanup
  // ---------------------------------------------------

  http.end();

  free(body);

  free(jpgBuf);

  body = NULL;

  jpgBuf = NULL;

  Serial.println();
  Serial.println("Upload complete.");
}


// =====================================================
// SETUP
// =====================================================
void setup() {

  Serial.begin(115200);

  delay(2000);

  Serial.println();
  Serial.println();
  Serial.println("======================================");
  Serial.println("      TOMATOGUARD ESP32-CAM");
  Serial.println("======================================");


  // ---------------------------------------------------
  // WiFi
  // ---------------------------------------------------

  if (!connectWiFi()) {

    Serial.println("WiFi failed.");

    return;
  }


  // ---------------------------------------------------
  // Camera
  // ---------------------------------------------------

  if (!initCamera()) {

    Serial.println("Camera failed.");

    return;
  }


  Serial.println();
  Serial.println("SYSTEM READY!");
  Serial.println();
}


// =====================================================
// LOOP
// =====================================================
void loop() {

  uploadImage();

  Serial.println();
  Serial.println("Waiting 20 seconds...");

  delay(20000);
}