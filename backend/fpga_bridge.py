"""
FPGA ↔ PC Python Bridge
=======================
Uses FPGA board's USB-UART (COM4) directly — no ESP32/WiFi needed!

How it works:
  1. FPGA sends "CAPTURE\n" when BTN0 is pressed (921600 baud)
  2. This script receives it on COM4
  3. Calls FastAPI backend → gets AI prediction
  4. Sends result back to FPGA: 0xBB [len] [label] [conf%] 0xCC

Setup:
  pip install pyserial requests

Usage:
  python fpga_bridge.py

Requirements:
  - Backend running: python main.py  (or start_all.bat)
  - FPGA programmed with main bitstream
  - COM4 is the FPGA's USB-UART Channel B
"""

import serial
import requests
import time
import json
import sys
import struct

# ── Configuration ─────────────────────────────────────────────
SERIAL_PORT  = "COM4"          # FPGA USB-UART port
BAUD_RATE    = 115200          # Must match top.v BAUD_RATE (115200 for USB-UART)
BACKEND_URL  = "http://localhost:8000/api/fpga/predict"
TIMEOUT_SEC  = 30

# ── Frame parameters (test frame sent to backend) ─────────────
IMG_WIDTH    = 160
IMG_HEIGHT   = 120

# ── Protocol ─────────────────────────────────────────────────
RESULT_START = 0xBB
RESULT_END   = 0xCC


def make_test_frame(width=IMG_WIDTH, height=IMG_HEIGHT):
    """Build a raw RGB565 test frame (green fill) with header."""
    header = bytes([0xAA, 0x55,
                    width >> 8, width & 0xFF,
                    height >> 8, height & 0xFF])
    # RGB565 green = 0x07E0
    pixels = bytes([0x07, 0xE0] * (width * height))
    return header + pixels


def call_backend(frame_bytes):
    """POST raw frame to FastAPI, return (label, confidence)."""
    try:
        r = requests.post(
            BACKEND_URL,
            data=frame_bytes,
            headers={"Content-Type": "application/octet-stream"},
            timeout=TIMEOUT_SEC
        )
        if r.status_code == 200:
            data = r.json()
            top = data.get("result", {}).get("top_prediction", {})
            label = top.get("label", "unknown")
            conf  = float(top.get("confidence", 0.0))
            return label, conf
        else:
            print(f"  Backend error {r.status_code}: {r.text[:100]}")
            return "error", 0.0
    except Exception as e:
        print(f"  Backend exception: {e}")
        return "timeout", 0.0


def send_result_to_fpga(ser, label, confidence):
    """
    Send AI result back to FPGA over UART.
    Format: 0xBB [len] [label ASCII bytes] [conf_percent 0-100] 0xCC
    """
    label_bytes = label[:20].encode("ascii", errors="replace")
    pct = min(int(confidence * 100), 255)
    packet = (bytes([RESULT_START, len(label_bytes)]) +
              label_bytes +
              bytes([pct, RESULT_END]))
    ser.write(packet)
    ser.flush()
    print(f"  Sent to FPGA: {label} ({pct}%)")


def check_backend():
    """Verify backend is reachable before starting."""
    try:
        r = requests.get("http://localhost:8000/api/fpga/status", timeout=5)
        if r.status_code == 200:
            print("  Backend reachable:", r.json())
            return True
    except Exception:
        pass
    try:
        r = requests.get("http://localhost:8000/api/model-status", timeout=5)
        if r.status_code == 200:
            print("  Backend reachable")
            return True
    except Exception:
        pass
    return False


def main():
    print("=" * 55)
    print("  FPGA-PC Bridge — Smart Agriculture AI")
    print("=" * 55)

    # Check backend
    print("\nChecking backend...")
    if not check_backend():
        print("  ERROR: Backend not running!")
        print("  Run: start_all.bat  or  python main.py")
        sys.exit(1)
    print("  Backend OK")

    # Open serial port
    print(f"\nOpening {SERIAL_PORT} at {BAUD_RATE} baud...")
    try:
        ser = serial.Serial(SERIAL_PORT, BAUD_RATE, timeout=0.1)
        print(f"  Connected to {SERIAL_PORT}")
    except serial.SerialException as e:
        print(f"  ERROR: Cannot open {SERIAL_PORT}: {e}")
        print("  Is the FPGA board plugged in?")
        print("  Is Vivado not using the port?")
        print(f"  Try changing SERIAL_PORT in this script")
        sys.exit(1)

    print("\nWaiting for FPGA button press (BTN0 = SW21)...")
    print("Press BTN0 on FPGA → AI runs → result shown here + sent to FPGA")
    print("-" * 55)

    buf = b""
    capture_count = 0

    try:
        while True:
            # Read available bytes
            if ser.in_waiting:
                buf += ser.read(ser.in_waiting)

            # Check for "CAPTURE\n" command in buffer
            if b"CAPTURE" in buf:
                idx = buf.find(b"CAPTURE")
                buf = buf[idx + len(b"CAPTURE"):]
                # Drain newline
                if buf.startswith(b"\n") or buf.startswith(b"\r"):
                    buf = buf[1:]

                capture_count += 1
                print(f"\n[#{capture_count}] CAPTURE received from FPGA!")

                # Build and send test frame to backend
                print(f"  Sending {IMG_WIDTH}x{IMG_HEIGHT} test frame to backend...")
                frame = make_test_frame()
                t0 = time.time()
                label, conf = call_backend(frame)
                elapsed = (time.time() - t0) * 1000
                print(f"  Result: {label}  {conf*100:.1f}%  ({elapsed:.0f}ms)")

                # Send result back to FPGA
                send_result_to_fpga(ser, label, conf)
                print(f"  Check dashboard: http://localhost:5173/history")

            time.sleep(0.01)

    except KeyboardInterrupt:
        print("\n\nStopped by user.")
    finally:
        ser.close()
        print("Serial port closed.")


if __name__ == "__main__":
    main()
