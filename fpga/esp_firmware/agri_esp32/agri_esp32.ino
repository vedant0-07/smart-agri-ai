// ============================================================
// ESP32 Firmware — FPGA Camera WiFi Bridge
// Receives raw RGB565 frame from FPGA via UART2
// POSTs to FastAPI backend, returns AI result to FPGA
//
// Wiring (ESP32 → FPGA board):
//   ESP32 GPIO16 (RX2) → FPGA J15 (wifi_txd = FPGA TX)
//   ESP32 GPIO17 (TX2) → FPGA G16 (wifi_rxd = FPGA RX)
//   ESP32 GND          → FPGA GND
//   ESP32 3.3V         → (ESP32 powered via its own USB)
//
// FPGA → ESP32 Frame Protocol (921600 baud):
//   0xAA 0x55 [width_hi] [width_lo] [height_hi] [height_lo]
//   [width*height*2 bytes of raw RGB565 pixels]
//
// ESP32 → FPGA Result:
//   0xBB [len] [label ASCII] [conf_percent] 0xCC
// ============================================================

#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

// ── WiFi & Backend ────────────────────────────────────────────
const char* WIFI_SSID     = "YOUR_WIFI_SSID";      // ← change
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";   // ← change
const char* BACKEND_HOST  = "192.168.1.100";        // ← your PC IP (run ipconfig)
const int   BACKEND_PORT  = 8000;
const char* FPGA_ENDPOINT = "/api/fpga/predict";

// ── UART2 pins (ESP32) ────────────────────────────────────────
// GPIO26 = labeled "D26" or "26" on your ESP32 board
// GPIO25 = labeled "D25" or "25" on your ESP32 board
#define RX2_PIN  26   // GPIO26 (D26) → connect to FPGA J15 pin
#define TX2_PIN  25   // GPIO25 (D25) → connect to FPGA G16 pin
#define BAUD_FPGA 921600

// ── Frame buffer ─────────────────────────────────────────────
// Max frame: 160x120x2 = 38400 bytes + 6 header = 38406
#define MAX_FRAME_BYTES 40000
uint8_t  frameBuf[MAX_FRAME_BYTES];
uint32_t framePos    = 0;
bool     frameReady  = false;
bool     inFrame     = false;
uint32_t expectedLen = 0;

// ── Text command buffer (for "CAPTURE\n") ────────────────────
String   cmdBuf      = "";
bool     captureCmd  = false;   // true when "CAPTURE\n" received

// ── Protocol markers ─────────────────────────────────────────
#define MAGIC1       0xAA
#define MAGIC2       0x55
#define RESULT_START 0xBB
#define RESULT_END   0xCC

// ── LED ───────────────────────────────────────────────────────
#define LED_PIN 2   // onboard LED on most ESP32 dev boards

// ─────────────────────────────────────────────────────────────
void setup() {
    Serial.begin(115200);          // debug serial (USB)
    Serial2.begin(BAUD_FPGA, SERIAL_8N1, RX2_PIN, TX2_PIN);  // FPGA UART

    pinMode(LED_PIN, OUTPUT);
    digitalWrite(LED_PIN, LOW);

    Serial.println("\nESP32 FPGA Bridge starting...");

    // Connect WiFi
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
    Serial.print("Connecting to WiFi");
    int retries = 0;
    while (WiFi.status() != WL_CONNECTED && retries < 30) {
        delay(500);
        Serial.print(".");
        retries++;
    }

    if (WiFi.status() == WL_CONNECTED) {
        Serial.println("\nWiFi connected!");
        Serial.print("IP: "); Serial.println(WiFi.localIP());
        // Signal FPGA: WiFi ready
        Serial2.write(0xAA); Serial2.write((uint8_t)0x01);
        digitalWrite(LED_PIN, HIGH);  // LED on = WiFi connected
    } else {
        Serial.println("\nWiFi FAILED!");
        Serial2.write(0xAA); Serial2.write((uint8_t)0x00);
    }

    Serial.println("Waiting for FPGA frame...");
}

// ─────────────────────────────────────────────────────────────
void loop() {
    // Receive frame bytes from FPGA via UART2
    while (Serial2.available() && !frameReady && !captureCmd) {
        uint8_t b = (uint8_t)Serial2.read();

        // ── Text command mode: "CAPTURE\n" ─────────────────────
        if (!inFrame && b >= 0x20 && b < 0x80) {
            // printable ASCII — accumulate as text command
            if (b == '\n') {
                cmdBuf.trim();
                if (cmdBuf == "CAPTURE") {
                    captureCmd = true;
                    Serial.println("CAPTURE command received from FPGA");
                }
                cmdBuf = "";
            } else {
                cmdBuf += (char)b;
                if (cmdBuf.length() > 10) cmdBuf = "";  // overflow protection
            }
            continue;
        }

        if (!inFrame) {
            if (framePos == 0 && b == MAGIC1) {
                frameBuf[0] = b;
                framePos = 1;
            } else if (framePos == 1 && b == MAGIC2) {
                frameBuf[1] = b;
                framePos = 2;
            } else if (framePos >= 2 && framePos < 6) {
                frameBuf[framePos++] = b;
                if (framePos == 6) {
                    uint16_t w = ((uint16_t)frameBuf[2] << 8) | frameBuf[3];
                    uint16_t h = ((uint16_t)frameBuf[4] << 8) | frameBuf[5];
                    expectedLen = (uint32_t)w * h * 2 + 6;
                    Serial.printf("Frame header: %dx%d (%u bytes)\n", w, h, expectedLen);
                    if (expectedLen <= MAX_FRAME_BYTES) {
                        inFrame = true;
                    } else {
                        Serial.println("Frame too large, resetting");
                        framePos = 0;
                    }
                }
            } else {
                framePos = 0;
            }
        } else {
            frameBuf[framePos++] = b;
            if (framePos >= expectedLen) {
                frameReady = true;
                inFrame    = false;
                framePos   = 0;
                Serial.println("Frame complete, sending to backend...");
                // Blink LED
                digitalWrite(LED_PIN, LOW);
                delay(50);
                digitalWrite(LED_PIN, HIGH);
            }
        }
    }

    // Process completed binary frame
    if (frameReady) {
        frameReady = false;
        if (WiFi.status() == WL_CONNECTED) {
            postFrameToBackend(frameBuf, expectedLen);
        } else {
            Serial.println("WiFi lost, reconnecting...");
            sendErrorToFPGA("NO_WIFI");
            WiFi.reconnect();
        }
    }

    // Process CAPTURE text command — send test frame to backend
    if (captureCmd) {
        captureCmd = false;
        Serial.println("Sending test frame to backend (camera not yet wired)...");
        if (WiFi.status() == WL_CONNECTED) {
            // Build 160x120 green test frame (same format as real camera)
            uint16_t w = 160, h = 120;
            uint32_t pixBytes = (uint32_t)w * h * 2;
            uint32_t totalLen = pixBytes + 6;
            uint8_t* buf = (uint8_t*)malloc(totalLen);
            if (buf) {
                buf[0]=0xAA; buf[1]=0x55;
                buf[2]=w>>8; buf[3]=w&0xFF;
                buf[4]=h>>8; buf[5]=h&0xFF;
                // RGB565 green: 0x07E0
                for (uint32_t i = 6; i < totalLen; i+=2) {
                    buf[i]   = 0x07;
                    buf[i+1] = 0xE0;
                }
                postFrameToBackend(buf, totalLen);
                free(buf);
            } else {
                sendErrorToFPGA("OOM");
            }
        } else {
            sendErrorToFPGA("NO_WIFI");
        }
    }
}

// ─────────────────────────────────────────────────────────────
void postFrameToBackend(uint8_t* data, uint32_t len) {
    HTTPClient http;
    String url = String("http://") + BACKEND_HOST + ":" +
                 String(BACKEND_PORT) + FPGA_ENDPOINT;

    Serial.printf("POST %s  (%u bytes)\n", url.c_str(), len);

    http.begin(url);
    http.setTimeout(30000);
    http.addHeader("Content-Type", "application/octet-stream");

    int code = http.POST(data, len);
    Serial.printf("HTTP response: %d\n", code);

    if (code == 200) {
        String body = http.getString();
        Serial.println("Response: " + body);
        parseAndSendResult(body);
    } else {
        String err = "HTTP" + String(code);
        Serial.println("Error: " + err);
        sendErrorToFPGA(err.c_str());
    }
    http.end();
}

// ─────────────────────────────────────────────────────────────
void parseAndSendResult(const String& json) {
    StaticJsonDocument<2048> doc;
    DeserializationError err = deserializeJson(doc, json);
    if (err) {
        Serial.println("JSON parse error: " + String(err.c_str()));
        sendErrorToFPGA("JSON_ERR");
        return;
    }

    // Try both result formats
    const char* label = nullptr;
    float conf = 0.0f;

    if (doc["result"]["top_prediction"]["label"].is<const char*>()) {
        label = doc["result"]["top_prediction"]["label"];
        conf  = doc["result"]["top_prediction"]["confidence"] | 0.0f;
    } else if (doc["result"]["predicted_class"].is<const char*>()) {
        label = doc["result"]["predicted_class"];
        conf  = doc["result"]["confidence"] | 0.0f;
    } else {
        label = "unknown";
    }

    uint8_t pct = (uint8_t)(conf * 100.0f);
    String lbl  = String(label).substring(0, 20);  // max 20 chars

    Serial.printf("Result: %s  %.1f%%\n", lbl.c_str(), conf * 100.0f);

    // Send to FPGA: 0xBB [len] [label] [conf%] 0xCC
    Serial2.write(RESULT_START);
    Serial2.write((uint8_t)lbl.length());
    Serial2.print(lbl);
    Serial2.write(pct);
    Serial2.write(RESULT_END);
    Serial2.flush();
}

void sendErrorToFPGA(const char* err) {
    String e = String(err).substring(0, 20);
    Serial2.write(RESULT_START);
    Serial2.write((uint8_t)e.length());
    Serial2.print(e);
    Serial2.write((uint8_t)0);
    Serial2.write(RESULT_END);
    Serial2.flush();
}
