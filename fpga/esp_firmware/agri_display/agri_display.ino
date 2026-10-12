/*
 * agri_display.ino
 * ================
 * ESP32 acts as WiFi → FPGA TFT bridge.
 *
 * Flow:
 *   Website AI result → POST http://ESP32_IP/result
 *   ESP32 → Serial2 UART → FPGA → TFT display
 *
 * Wiring (ESP32 → FPGA):
 *   GPIO17 (TX2) → FPGA esp_rx pin (G16 or C4)
 *   GPIO16 (RX2) ← FPGA esp_tx pin (not used)
 *   GND          → FPGA GND
 *
 * Protocol to FPGA:
 *   0xBB [len] [label ASCII] [conf_percent 0-100] 0xCC
 */

#include <WiFi.h>
#include <WebServer.h>
#include <ArduinoJson.h>

// ── WiFi credentials ──────────────────────────────────────────
const char* WIFI_SSID     = "YOUR_WIFI_SSID";      // ← CHANGE
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";   // ← CHANGE

// ── UART to FPGA ──────────────────────────────────────────────
#define FPGA_TX_PIN  17   // ESP32 TX → FPGA RX
#define FPGA_RX_PIN  16   // ESP32 RX ← FPGA TX (unused)
#define FPGA_BAUD    115200

// ── HTTP server ───────────────────────────────────────────────
WebServer server(80);

// ── Protocol ──────────────────────────────────────────────────
#define RESULT_START  0xBB
#define RESULT_END    0xCC

// ─────────────────────────────────────────────────────────────
void sendToFPGA(String label, int confidence_pct) {
  // Clamp label to 20 chars
  if (label.length() > 20) label = label.substring(0, 20);
  int len = label.length();
  uint8_t lbl[20];
  label.getBytes(lbl, len + 1);

  // Packet: BB [len] [label bytes] [conf%] CC
  Serial2.write(RESULT_START);
  Serial2.write((uint8_t)len);
  Serial2.write(lbl, len);
  Serial2.write((uint8_t)confidence_pct);
  Serial2.write(RESULT_END);
  Serial2.flush();

  Serial.printf("→ FPGA: [%s] %d%%\n", label.c_str(), confidence_pct);
}

// ─────────────────────────────────────────────────────────────
void handleResult() {
  // Allow CORS (website on different origin)
  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.sendHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  server.sendHeader("Access-Control-Allow-Headers", "Content-Type");

  if (server.method() == HTTP_OPTIONS) {
    server.send(204);
    return;
  }

  if (!server.hasArg("plain")) {
    server.send(400, "application/json", "{\"error\":\"no body\"}");
    return;
  }

  String body = server.arg("plain");
  Serial.println("Received: " + body);

  StaticJsonDocument<512> doc;
  DeserializationError err = deserializeJson(doc, body);
  if (err) {
    server.send(400, "application/json", "{\"error\":\"bad json\"}");
    return;
  }

  // Extract label + confidence
  const char* label  = doc["label"]  | doc["predicted_label"] | "unknown";
  int conf = 0;
  if (doc.containsKey("confidence_percent"))
    conf = (int)doc["confidence_percent"].as<float>();
  else if (doc.containsKey("confidence"))
    conf = (int)(doc["confidence"].as<float>() * 100);

  sendToFPGA(String(label), conf);

  server.send(200, "application/json", "{\"status\":\"ok\",\"sent_to_fpga\":true}");
}

void handleStatus() {
  server.sendHeader("Access-Control-Allow-Origin", "*");
  String json = "{\"status\":\"online\",\"ip\":\"" + WiFi.localIP().toString() + "\"}";
  server.send(200, "application/json", json);
}

void handleRoot() {
  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.send(200, "text/plain",
    "Smart Agriculture ESP32 Bridge\n"
    "POST /result  {label, confidence_percent}\n"
    "GET  /status\n");
}

// ─────────────────────────────────────────────────────────────
void setup() {
  Serial.begin(115200);
  Serial.println("\nESP32 Display Bridge Starting...");

  // UART to FPGA
  Serial2.begin(FPGA_BAUD, SERIAL_8N1, FPGA_RX_PIN, FPGA_TX_PIN);
  Serial.printf("UART2 ready at %d baud (TX=GPIO%d)\n", FPGA_BAUD, FPGA_TX_PIN);

  // Connect WiFi
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.print("Connecting to WiFi");
  int tries = 0;
  while (WiFi.status() != WL_CONNECTED && tries < 30) {
    delay(500); Serial.print("."); tries++;
  }
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\nWiFi connected!");
    Serial.println("ESP32 IP: " + WiFi.localIP().toString());
    Serial.println("Backend should POST to: http://" + WiFi.localIP().toString() + "/result");
  } else {
    Serial.println("\nWiFi FAILED! Check credentials.");
  }

  // Register routes
  server.on("/",       HTTP_GET,  handleRoot);
  server.on("/status", HTTP_GET,  handleStatus);
  server.on("/result", HTTP_POST, handleResult);
  server.on("/result", HTTP_OPTIONS, handleResult);
  server.begin();
  Serial.println("HTTP server started on port 80");
}

void loop() {
  server.handleClient();
}
