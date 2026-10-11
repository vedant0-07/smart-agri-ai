"""
FPGA Streaming Bridge
=====================
Connects FPGA USB-UART (COM4) to FastAPI backend.
Receives OV7670 camera frames → runs AI → streams to web.

Architecture:
  FPGA (OV7670 → BRAM → UART 921600) → COM4 → THIS SCRIPT
  → POST /api/fpga/predict  → AI result
  → Send result back to FPGA over COM4
  → Serve MJPEG stream at http://localhost:8888/stream
  → Serve latest JPEG at  http://localhost:8888/snapshot

Install:
  pip install pyserial requests pillow

Run BEFORE starting web dashboard:
  python fpga_stream_bridge.py

Then open: http://localhost:5173/camera
"""

import serial
import requests
import threading
import time
import io
import struct
import json
import logging
from http.server import HTTPServer, BaseHTTPRequestHandler
from PIL import Image
import numpy as np

# ── Config ────────────────────────────────────────────────────
SERIAL_PORT   = "COM4"
BAUD_RATE     = 921600
BACKEND_URL   = "http://localhost:8000/api/fpga/predict"
STREAM_HOST   = "localhost"
STREAM_PORT   = 8888
MODEL_ID      = "pest_detection"   # can be changed at runtime

# ── Protocol ──────────────────────────────────────────────────
MAGIC1       = 0xAA
MAGIC2       = 0x55
RESULT_START = 0xBB
RESULT_END   = 0xCC

logging.basicConfig(level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s')
log = logging.getLogger(__name__)

# ── Shared state (thread-safe with lock) ──────────────────────
_lock          = threading.Lock()
_latest_jpeg   = b""        # latest snapshot as JPEG bytes
_latest_result = {}         # latest AI result dict
_frame_count   = 0
_fps           = 0.0

# MJPEG stream subscribers
_subscribers   = []
_sub_lock      = threading.Lock()


def rgb565_to_jpeg(raw: bytes, w: int, h: int) -> bytes:
    """Convert raw RGB565 bytes → JPEG bytes."""
    px = np.frombuffer(raw[:w*h*2], dtype=np.uint16)
    r = ((px >> 11) & 0x1F).astype(np.uint8) * 8
    g = ((px >>  5) & 0x3F).astype(np.uint8) * 4
    b = ( px        & 0x1F).astype(np.uint8) * 8
    rgb = np.stack([r, g, b], axis=-1).reshape(h, w, 3)
    img = Image.fromarray(rgb, 'RGB').resize((640, 480), Image.LANCZOS)
    buf = io.BytesIO()
    img.save(buf, 'JPEG', quality=80)
    return buf.getvalue()


def call_backend(frame_bytes: bytes):
    """POST raw frame to backend, return result dict."""
    try:
        r = requests.post(BACKEND_URL, data=frame_bytes,
                          headers={"Content-Type": "application/octet-stream"},
                          timeout=15)
        if r.status_code == 200:
            return r.json()
    except Exception as e:
        log.warning(f"Backend error: {e}")
    return {}


def send_result_to_fpga(ser: serial.Serial, label: str, confidence: float):
    """Send 0xBB [len] [label] [conf%] 0xCC to FPGA."""
    lb = label[:20].encode("ascii", errors="replace")
    pct = min(int(confidence * 100), 255)
    pkt = bytes([RESULT_START, len(lb)]) + lb + bytes([pct, RESULT_END])
    try:
        ser.write(pkt)
        ser.flush()
    except Exception as e:
        log.warning(f"Serial write error: {e}")


def broadcast_frame(jpeg: bytes):
    """Push JPEG frame to all MJPEG stream subscribers."""
    part = (b"--frame\r\n"
            b"Content-Type: image/jpeg\r\n\r\n" + jpeg + b"\r\n")
    dead = []
    with _sub_lock:
        for q in _subscribers:
            try:
                q.put_nowait(part)
            except Exception:
                dead.append(q)
        for q in dead:
            _subscribers.remove(q)


# ── MJPEG HTTP server ─────────────────────────────────────────
import queue as qmod

class StreamHandler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        pass  # suppress default access log

    def send_cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_cors()
        self.end_headers()

    def do_GET(self):
        if self.path == "/stream":
            self._handle_stream()
        elif self.path == "/snapshot":
            self._handle_snapshot()
        elif self.path == "/result":
            self._handle_result()
        elif self.path == "/status":
            self._handle_status()
        else:
            self.send_response(404)
            self.end_headers()

    def _handle_stream(self):
        self.send_response(200)
        self.send_header("Content-Type",
                         "multipart/x-mixed-replace; boundary=frame")
        self.send_cors()
        self.end_headers()
        q = qmod.Queue(maxsize=2)
        with _sub_lock:
            _subscribers.append(q)
        try:
            while True:
                try:
                    part = q.get(timeout=5)
                    self.wfile.write(part)
                    self.wfile.flush()
                except qmod.Empty:
                    # Send keep-alive empty frame
                    with _lock:
                        snap = _latest_jpeg
                    if snap:
                        self.wfile.write(
                            b"--frame\r\nContent-Type: image/jpeg\r\n\r\n"
                            + snap + b"\r\n")
                        self.wfile.flush()
        except Exception:
            pass
        finally:
            with _sub_lock:
                if q in _subscribers:
                    _subscribers.remove(q)

    def _handle_snapshot(self):
        with _lock:
            snap = _latest_jpeg
        if not snap:
            self.send_response(204)
            self.end_headers()
            return
        self.send_response(200)
        self.send_header("Content-Type", "image/jpeg")
        self.send_header("Content-Length", str(len(snap)))
        self.send_cors()
        self.end_headers()
        self.wfile.write(snap)

    def _handle_result(self):
        with _lock:
            res = dict(_latest_result)
            fc  = _frame_count
            fps = _fps
        body = json.dumps({"result": res, "frames": fc, "fps": fps}).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.send_cors()
        self.end_headers()
        self.wfile.write(body)

    def _handle_status(self):
        with _lock:
            fc  = _frame_count
            fps = _fps
        body = json.dumps({"frames": fc, "fps": round(fps, 1),
                           "port": SERIAL_PORT, "baud": BAUD_RATE}).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_cors()
        self.end_headers()
        self.wfile.write(body)


def run_stream_server():
    srv = HTTPServer((STREAM_HOST, STREAM_PORT), StreamHandler)
    log.info(f"MJPEG stream: http://{STREAM_HOST}:{STREAM_PORT}/stream")
    log.info(f"Snapshot:     http://{STREAM_HOST}:{STREAM_PORT}/snapshot")
    srv.serve_forever()


# ── Serial frame receiver ─────────────────────────────────────
def run_serial_receiver():
    global _frame_count, _fps, _latest_jpeg, _latest_result

    log.info(f"Opening {SERIAL_PORT} at {BAUD_RATE} baud…")
    try:
        ser = serial.Serial(SERIAL_PORT, BAUD_RATE, timeout=0.05)
    except Exception as e:
        log.error(f"Cannot open {SERIAL_PORT}: {e}")
        log.error("Is FPGA board connected? Is COM4 the right port?")
        return

    log.info(f"Connected to {SERIAL_PORT}")

    buf        = bytearray()
    in_frame   = False
    width      = 0
    height     = 0
    expected   = 0
    fps_cnt    = 0
    fps_ts     = time.time()

    while True:
        chunk = ser.read(ser.in_waiting or 1)
        if not chunk:
            time.sleep(0.001)
            continue

        buf.extend(chunk)

        while len(buf) >= 2:
            if not in_frame:
                # Look for magic header 0xAA 0x55
                idx = -1
                for i in range(len(buf) - 1):
                    if buf[i] == MAGIC1 and buf[i+1] == MAGIC2:
                        idx = i; break
                if idx < 0:
                    buf = buf[-1:]  # keep last byte (might be first magic byte)
                    break
                buf = buf[idx:]  # trim to magic start

                if len(buf) < 6:
                    break   # need full header

                width    = (buf[2] << 8) | buf[3]
                height   = (buf[4] << 8) | buf[5]
                expected = width * height * 2 + 6
                if width == 0 or height == 0 or expected > 100000:
                    buf = buf[2:]  # bad header, skip
                    continue
                in_frame = True
                log.debug(f"Frame header: {width}x{height} ({expected} bytes)")

            else:
                if len(buf) < expected:
                    break   # wait for full frame

                frame_bytes = bytes(buf[:expected])
                buf = buf[expected:]
                in_frame = False

                # Convert & broadcast snapshot
                try:
                    jpeg = rgb565_to_jpeg(frame_bytes[6:], width, height)
                    with _lock:
                        _latest_jpeg = jpeg
                    broadcast_frame(jpeg)
                except Exception as e:
                    log.warning(f"Frame convert error: {e}")
                    continue

                fps_cnt += 1
                now = time.time()
                if now - fps_ts >= 1.0:
                    with _lock:
                        _fps = fps_cnt / (now - fps_ts)
                    fps_cnt = 0
                    fps_ts  = now

                with _lock:
                    _frame_count += 1
                    fc = _frame_count

                log.info(f"Frame #{fc}: {width}x{height} → inference…")

                # AI inference in background thread
                def process(fb):
                    result = call_backend(fb)
                    if not result:
                        return
                    top = result.get("result", {}).get("top_prediction", {})
                    lbl  = top.get("label", "unknown")
                    conf = float(top.get("confidence", 0.0))
                    pct  = top.get("confidence_percent", conf * 100)
                    log.info(f"  → {lbl}  {pct:.1f}%  "
                             f"({result.get('inference_time_ms', 0):.0f}ms)")
                    with _lock:
                        _latest_result.update(result)
                    send_result_to_fpga(ser, lbl, conf)

                threading.Thread(target=process, args=(frame_bytes,),
                                 daemon=True).start()


def generate_test_frame():
    """Generate a colorful test frame (RGB565 → JPEG) as placeholder."""
    import random
    w, h = 160, 120
    # Create gradient test image
    img_array = np.zeros((h, w, 3), dtype=np.uint8)
    for y in range(h):
        for x in range(w):
            img_array[y, x] = [
                int(255 * x / w),        # R gradient left→right
                int(255 * y / h),        # G gradient top→bottom
                128                       # B constant
            ]
    img = Image.fromarray(img_array, 'RGB').resize((640, 480), Image.LANCZOS)
    from PIL import ImageDraw, ImageFont
    draw = ImageDraw.Draw(img)
    draw.rectangle([0, 0, 640, 60], fill=(0, 0, 0, 180))
    draw.text((20, 10), "FPGA OV7670 — Waiting for FPGA stream...", fill=(0, 255, 128))
    draw.text((20, 35), f"Run synthesis + program FPGA board, then stream starts auto", fill=(180, 180, 180))
    buf = io.BytesIO()
    img.save(buf, 'JPEG', quality=80)
    return buf.getvalue()


def run_test_frame_generator():
    """Send test frames when no real FPGA frames arriving."""
    global _latest_jpeg
    time.sleep(2)   # give real data a chance first
    while True:
        with _lock:
            has_data = len(_latest_jpeg) > 0
            fc = _frame_count
        if not has_data or fc == 0:
            try:
                jpeg = generate_test_frame()
                with _lock:
                    _latest_jpeg = jpeg
                broadcast_frame(jpeg)
                log.info("Test frame generated (no FPGA data yet)")
            except Exception as e:
                log.debug(f"Test frame error: {e}")
        time.sleep(3)



if __name__ == "__main__":
    print("=" * 58)
    print("  FPGA OV7670 Camera Bridge — Smart Agriculture AI")
    print("=" * 58)
    print(f"  MJPEG Stream : http://localhost:{STREAM_PORT}/stream")
    print(f"  Snapshot     : http://localhost:{STREAM_PORT}/snapshot")
    print(f"  AI Result    : http://localhost:{STREAM_PORT}/result")
    print(f"  Status       : http://localhost:{STREAM_PORT}/status")
    print("=" * 58)

    # Check backend
    try:
        r = requests.get("http://localhost:8000/api/fpga/status", timeout=3)
        print(f"\n  Backend: OK — {r.json()}")
    except Exception:
        print("\n  WARNING: Backend not responding. Start start_all.bat first!")

    # Start MJPEG server
    srv_thread = threading.Thread(target=run_stream_server, daemon=True)
    srv_thread.start()

    # Start test frame generator (shows placeholder when FPGA not streaming)
    test_thread = threading.Thread(target=run_test_frame_generator, daemon=True)
    test_thread.start()

    time.sleep(0.3)

    # Start serial receiver (blocking)
    try:
        run_serial_receiver()
    except KeyboardInterrupt:
        print("\nStopped.")
