// ============================================================
// ESP-12F Firmware — OV7670 (5110v0) Camera Bridge
// Receives raw RGB565 image from FPGA via UART
// POSTs to FastAPI backend as binary blob
// Returns AI result to FPGA via UART
//
// FPGA → ESP Protocol (UART 921600 baud):
//   Byte 0:    0xAA  (start)
//   Byte 1:    0x55  (start)
//   Byte 2:    width_hi
//   Byte 3:    width_lo   (e.g. 0x00 0xA0 = 160)
//   Byte 4:    height_hi
//   Byte 5:    height_lo  (e.g. 0x00 0x78 = 120)
//   Byte 6..N: raw RGB565 pixels (width*height*2 bytes)
//
// Backend endpoint: POST http://PC_IP:8000/api/fpga/predict
// Body: same binary format (0xAA 0x55 + header + pixels)
//
// ESP → FPGA Result Protocol:
//   0xBB [len] [label] [conf%] 0xCC
// ============================================================

#include <ESP8266WiFi.h>
#include <ESP8266HTTPClient.h>
#include <WiFiClient.h>
#include <ArduinoJson.h>

// ── WiFi credentials ─────────────────────────────────────────
const char* WIFI_SSID     = "Khorgade";      // ← change
const char* WIFI_PASSWORD = "11001100";   // ← change
const char* BACKEND_HOST  = "192.168.1.38";        // ← your PC IP
const int   BACKEND_PORT  = 8000;
const char* FPGA_ENDPOINT = "/api/fpga/predict";

// ── UART configuration ───────────────────────────────────────
// High baud rate to transfer 38400 bytes faster
// 38400 bytes at 921600 baud ≈ 0.5 seconds
#define BAUD_RATE 921600

// ── Frame parameters (must match FPGA capture settings) ──────
#define IMG_WIDTH   160
#define IMG_HEIGHT  120
#define IMG_BYTES   (IMG_WIDTH * IMG_HEIGHT * 2)  // 38400 bytes

// ── Protocol markers ─────────────────────────────────────────
#define FRAME_MAGIC1  0xAA
#define FRAME_MAGIC2  0x55
#define RESULT_START  0xBB
#define RESULT_END    0xCC

// ── Globals ──────────────────────────────────────────────────
uint8_t  frameBuf[IMG_BYTES + 6];  // 6 byte header + pixels
uint32_t framePos    = 0;
bool     frameReady  = false;
bool     inFrame     = false;
uint32_t expectedLen = 0;

// ─────────────────────────────────────────────────────────────
void setup() {
    Serial.begin(BAUD_RATE);
    delay(300);

    // Connect WiFi
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
    uint8_t retries = 0;
    while (WiFi.status() != WL_CONNECTED && retries < 40) {
        delay(500);
        retries++;
    }

    // Signal FPGA: WiFi status
    if (WiFi.status() == WL_CONNECTED) {
        Serial.write(0xAA); Serial.write((uint8_t)0x01);
    } else {
        Serial.write(0xAA); Serial.write((uint8_t)0x00);
    }
}

// ─────────────────────────────────────────────────────────────
void loop() {
    // ── Receive frame from FPGA ───────────────────────────────
    while (Serial.available() && !frameReady) {
        uint8_t b = Serial.read();

        if (!inFrame) {
            // Look for magic bytes 0xAA 0x55
            if (framePos == 0 && b == FRAME_MAGIC1) {
                frameBuf[0] = b;
                framePos = 1;
            } else if (framePos == 1 && b == FRAME_MAGIC2) {
                frameBuf[1] = b;
                framePos = 2;
            } else if (framePos >= 2 && framePos < 6) {
                // Header bytes: width_hi, width_lo, height_hi, height_lo
                frameBuf[framePos++] = b;
                if (framePos == 6) {
                    uint16_t w = ((uint16_t)frameBuf[2] << 8) | frameBuf[3];
                    uint16_t h = ((uint16_t)frameBuf[4] << 8) | frameBuf[5];
                    expectedLen = (uint32_t)w * h * 2 + 6;
                    if (expectedLen <= sizeof(frameBuf)) {
                        inFrame = true;
                    } else {
                        framePos = 0;  // too large, reset
                    }
                }
            } else {
                framePos = 0;  // reset on unexpected byte
            }
        } else {
            // Receive pixel data
            frameBuf[framePos++] = b;
            if (framePos >= expectedLen) {
                frameReady = true;
                inFrame    = false;
                framePos   = 0;
            }
        }
    }

    // ── Process completed frame ───────────────────────────────
    if (frameReady) {
        frameReady = false;
        if (WiFi.status() == WL_CONNECTED) {
            postFrameToBackend(frameBuf, expectedLen);
        } else {
            sendErrorToFPGA("NO_WIFI");
            // Try reconnect
            WiFi.reconnect();
        }
    }
}

// ─────────────────────────────────────────────────────────────
// POST raw frame buffer to /api/fpga/predict
// Body = raw binary (same format as received from FPGA)
// ─────────────────────────────────────────────────────────────
void postFrameToBackend(uint8_t* data, uint32_t len) {
    WiFiClient client;
    HTTPClient http;

    String url = String("http://") + BACKEND_HOST + ":" +
                 String(BACKEND_PORT) + FPGA_ENDPOINT;

    http.begin(client, url);
    http.setTimeout(30000);
    http.addHeader("Content-Type", "application/octet-stream");
    http.addHeader("Content-Length", String(len));

    // POST raw binary directly — no multipart overhead
    int code = http.POST(data, len);

    if (code == HTTP_CODE_OK) {
        parseAndSendResult(http.getString());
    } else {
        sendErrorToFPGA(("HTTP" + String(code)).c_str());
    }
    http.end();
}

// ─────────────────────────────────────────────────────────────
void parseAndSendResult(const String& json) {
    StaticJsonDocument<1024> doc;
    if (deserializeJson(doc, json) != DeserializationError::Ok) {
        sendErrorToFPGA("JSON_ERR");
        return;
    }

    const char* label = doc["result"]["top_prediction"]["label"]     |
                        doc["result"]["predicted_class"]             |
                        "unknown";
    float conf = doc["result"]["top_prediction"]["confidence"]       |
                 doc["result"]["confidence"]                         | 0.0f;
    uint8_t pct = (uint8_t)(conf * 100.0f);

    String lbl = String(label);
    if (lbl.length() > 20) lbl = lbl.substring(0, 20);

    // Send result to FPGA
    Serial.write(RESULT_START);
    Serial.write((uint8_t)lbl.length());
    for (int i = 0; i < (int)lbl.length(); i++)
        Serial.write((uint8_t)lbl[i]);
    Serial.write(pct);
    Serial.write(RESULT_END);
}

void sendErrorToFPGA(const char* err) {
    String e = String(err).substring(0, 20);
    Serial.write(RESULT_START);
    Serial.write((uint8_t)e.length());
    for (int i = 0; i < (int)e.length(); i++)
        Serial.write((uint8_t)e[i]);
    Serial.write((uint8_t)0);
    Serial.write(RESULT_END);
}
