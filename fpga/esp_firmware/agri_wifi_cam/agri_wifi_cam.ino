// ============================================================
// ESP-12F (ESP8266) Firmware — WITH ArduCAM OV2640
// Smart Agriculture AI — Camera + WiFi Bridge
//
// Hardware needed:
//   ArduCAM Mini OV2640 2MP SPI module
//   Connect to ESP-12F GPIO:
//     ArduCAM SCK  → GPIO14  (D5)
//     ArduCAM MISO → GPIO12  (D6)
//     ArduCAM MOSI → GPIO13  (D7)
//     ArduCAM CS   → GPIO16  (D0) — SPI CS for SPI interface
//     ArduCAM SDA  → GPIO4   (D2) — I2C SDA for SCCB
//     ArduCAM SCL  → GPIO5   (D1) — I2C SCL for SCCB
//     ArduCAM VCC  → 3.3V
//     ArduCAM GND  → GND
//
// Arduino IDE Libraries needed:
//   1. ArduCAM (by ArduCAM)  — install from Library Manager
//   2. ArduinoJson (v6.x)
//   3. esp8266 board support
//
// Board: Generic ESP8266 Module
// ============================================================

#include <ESP8266WiFi.h>
#include <ESP8266HTTPClient.h>
#include <WiFiClient.h>
#include <ArduinoJson.h>
#include <Wire.h>
#include <SPI.h>

// ── IMPORTANT: Edit ArduCAM/memorysaver.h, uncomment ONLY:
// #define OV2640_MINI_2MP_PLUS
#include <ArduCAM.h>
#include <memorysaver.h>

// ── WiFi credentials ─────────────────────────────────────────
const char* WIFI_SSID     = "YOUR_WIFI_SSID";       // ← change
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";    // ← change
const char* BACKEND_HOST  = "192.168.1.100";         // ← your PC IP
const int   BACKEND_PORT  = 8000;

// ── Model endpoint — change to test different models ─────────
// Options: /api/pest/predict  /api/plant/predict
//          /api/fertilizer/predict  /api/irrigation/predict
const char* ENDPOINT = "/api/pest/predict";

// ── ArduCAM CS pin ────────────────────────────────────────────
const int CAM_CS = 16;  // GPIO16 = D0

// ── UART to FPGA ─────────────────────────────────────────────
#define FPGA_SERIAL  Serial
#define BAUD_RATE    115200

// ── Protocol markers ─────────────────────────────────────────
#define RESULT_START 0xBB
#define RESULT_END   0xCC

// ── Globals ──────────────────────────────────────────────────
ArduCAM  myCAM(OV2640, CAM_CS);
String   cmdBuffer = "";
bool     captureReady = false;

// ─────────────────────────────────────────────────────────────
void setup() {
    FPGA_SERIAL.begin(BAUD_RATE);
    delay(200);

    // Init SPI and I2C
    Wire.begin(4, 5);     // SDA=GPIO4, SCL=GPIO5
    SPI.begin();
    SPI.setFrequency(4000000);  // 4 MHz

    // Init ArduCAM
    myCAM.write_reg(0x07, 0x80);
    delay(100);
    myCAM.write_reg(0x07, 0x00);
    delay(100);

    // Verify SPI bus
    myCAM.write_reg(ARDUCHIP_TEST1, 0x55);
    uint8_t temp = myCAM.read_reg(ARDUCHIP_TEST1);
    if (temp != 0x55) {
        FPGA_SERIAL.println("SPI error — check wiring!");
        while (1);
    }

    // Verify camera sensor
    myCAM.wrSensorReg8_8(0xff, 0x01);
    uint8_t vid, pid;
    myCAM.rdSensorReg8_8(OV2640_CHIPID_HIGH, &vid);
    myCAM.rdSensorReg8_8(OV2640_CHIPID_LOW, &pid);
    if ((vid != 0x26) && ((pid != 0x41) || (pid != 0x42))) {
        FPGA_SERIAL.println("Camera not found!");
    }

    // Configure camera: JPEG 320x240 (good balance of quality/speed)
    myCAM.set_format(JPEG);
    myCAM.InitCAM();
    myCAM.OV2640_set_JPEG_size(OV2640_320x240);
    myCAM.set_bit(ARDUCHIP_TIM, VSYNC_LEVEL_MASK);
    myCAM.clear_fifo_flag();
    delay(1000);

    // Connect WiFi
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
    int retries = 0;
    while (WiFi.status() != WL_CONNECTED && retries < 30) {
        delay(500);
        retries++;
    }

    if (WiFi.status() == WL_CONNECTED) {
        // Notify FPGA: WiFi connected (0xAA 0x01)
        FPGA_SERIAL.write(0xAA);
        FPGA_SERIAL.write((uint8_t)0x01);
    } else {
        FPGA_SERIAL.write(0xAA);
        FPGA_SERIAL.write((uint8_t)0x00);
    }
}

// ─────────────────────────────────────────────────────────────
void loop() {
    // Read FPGA UART command
    while (FPGA_SERIAL.available()) {
        char c = (char)FPGA_SERIAL.read();
        if (c == '\n') {
            cmdBuffer.trim();
            if (cmdBuffer == "CAPTURE") captureReady = true;
            cmdBuffer = "";
        } else {
            cmdBuffer += c;
        }
    }

    if (captureReady) {
        captureReady = false;
        if (WiFi.status() == WL_CONNECTED) {
            captureAndInfer();
        } else {
            sendErrorToFPGA("NO_WIFI");
        }
    }
}

// ─────────────────────────────────────────────────────────────
// Capture JPEG from ArduCAM and POST to backend
// ─────────────────────────────────────────────────────────────
void captureAndInfer() {
    // Trigger capture
    myCAM.flush_fifo();
    myCAM.clear_fifo_flag();
    myCAM.start_capture();

    // Wait for capture done (timeout 3s)
    unsigned long t = millis();
    while (!myCAM.get_bit(ARDUCHIP_TRIG, CAP_DONE_MASK)) {
        if (millis() - t > 3000) {
            sendErrorToFPGA("CAM_TIMEOUT");
            return;
        }
    }

    uint32_t imgLen = myCAM.read_fifo_length();
    if (imgLen >= MAX_FIFO_SIZE || imgLen == 0) {
        sendErrorToFPGA("FIFO_ERR");
        return;
    }

    // Read JPEG from FIFO into buffer
    // For ESP8266 with 80KB RAM, limit to ~40KB
    const uint32_t MAX_IMG = 40000;
    if (imgLen > MAX_IMG) imgLen = MAX_IMG;

    uint8_t* imgBuf = (uint8_t*)malloc(imgLen);
    if (!imgBuf) {
        sendErrorToFPGA("OOM");
        return;
    }

    myCAM.CS_LOW();
    myCAM.set_fifo_burst();
    SPI.transfer(0x00);  // dummy byte
    for (uint32_t i = 0; i < imgLen; i++) {
        imgBuf[i] = SPI.transfer(0x00);
    }
    myCAM.CS_HIGH();

    // POST to backend
    postImageToBackend(imgBuf, imgLen);
    free(imgBuf);
}

// ─────────────────────────────────────────────────────────────
void postImageToBackend(uint8_t* imgData, uint32_t imgLen) {
    WiFiClient client;
    HTTPClient http;

    String url = String("http://") + BACKEND_HOST + ":" +
                 String(BACKEND_PORT) + ENDPOINT;

    http.begin(client, url);
    http.setTimeout(30000);

    // Build multipart body
    String boundary = "----ArduCamBoundary";
    String head = "--" + boundary + "\r\n"
                + "Content-Disposition: form-data; name=\"file\"; filename=\"capture.jpg\"\r\n"
                + "Content-Type: image/jpeg\r\n\r\n";
    String tail = "\r\n--" + boundary + "--\r\n";

    int totalLen = head.length() + imgLen + tail.length();
    http.addHeader("Content-Type", "multipart/form-data; boundary=" + boundary);

    // Stream the POST body in chunks (ESP8266 memory limit)
    uint8_t* full = (uint8_t*)malloc(totalLen);
    if (!full) { sendErrorToFPGA("OOM"); http.end(); return; }

    memcpy(full, head.c_str(), head.length());
    memcpy(full + head.length(), imgData, imgLen);
    memcpy(full + head.length() + imgLen, tail.c_str(), tail.length());

    int code = http.POST(full, totalLen);
    free(full);

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

    const char* label = doc["result"]["predicted_class"] | "unknown";
    float       conf  = doc["result"]["confidence"]      | 0.0f;
    uint8_t     pct   = (uint8_t)(conf * 100.0f);

    String lbl = String(label);
    if (lbl.length() > 20) lbl = lbl.substring(0, 20);

    // Send to FPGA: 0xBB [len] [label] [conf%] 0xCC
    FPGA_SERIAL.write(RESULT_START);
    FPGA_SERIAL.write((uint8_t)lbl.length());
    FPGA_SERIAL.print(lbl);
    FPGA_SERIAL.write(pct);
    FPGA_SERIAL.write(RESULT_END);
}

void sendErrorToFPGA(const char* err) {
    String e = String(err).substring(0, 20);
    FPGA_SERIAL.write(RESULT_START);
    FPGA_SERIAL.write((uint8_t)e.length());
    FPGA_SERIAL.print(e);
    FPGA_SERIAL.write((uint8_t)0);
    FPGA_SERIAL.write(RESULT_END);
}
