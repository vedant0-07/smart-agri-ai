"""
Quick test: POST a sample image to the FastAPI backend
and print the AI inference result.

Usage: python test_inference.py
"""
import requests
import json
import sys
import os

BACKEND = "http://localhost:8000"

# Test each model
ENDPOINTS = {
    "Pest Detection":        "/api/pest/predict",
    "Plant Disease":         "/api/plant/predict",
    "Fertilizer Recommend":  "/api/fertilizer/predict",
    "Irrigation Predict":    "/api/irrigation/predict",
}

def test_model(name, endpoint):
    """POST a sample image to the given endpoint and print result."""
    # Use a small solid-color JPEG (valid JPEG, ~200 bytes)
    # This tests the full pipeline: network → backend → model → response
    import struct, zlib

    # Minimal valid 1x1 green JPEG
    jpeg_bytes = bytes([
        0xFF,0xD8,0xFF,0xE0,0x00,0x10,0x4A,0x46,0x49,0x46,0x00,0x01,
        0x01,0x00,0x00,0x01,0x00,0x01,0x00,0x00,0xFF,0xDB,0x00,0x43,
        0x00,0x08,0x06,0x06,0x07,0x06,0x05,0x08,0x07,0x07,0x07,0x09,
        0x09,0x08,0x0A,0x0C,0x14,0x0D,0x0C,0x0B,0x0B,0x0C,0x19,0x12,
        0x13,0x0F,0x14,0x1D,0x1A,0x1F,0x1E,0x1D,0x1A,0x1C,0x1C,0x20,
        0x24,0x2E,0x27,0x20,0x22,0x2C,0x23,0x1C,0x1C,0x28,0x37,0x29,
        0x2C,0x30,0x31,0x34,0x34,0x34,0x1F,0x27,0x39,0x3D,0x38,0x32,
        0x3C,0x2E,0x33,0x34,0x32,0xFF,0xC0,0x00,0x0B,0x08,0x00,0x01,
        0x00,0x01,0x01,0x01,0x11,0x00,0xFF,0xC4,0x00,0x1F,0x00,0x00,
        0x01,0x05,0x01,0x01,0x01,0x01,0x01,0x01,0x00,0x00,0x00,0x00,
        0x00,0x00,0x00,0x00,0x01,0x02,0x03,0x04,0x05,0x06,0x07,0x08,
        0x09,0x0A,0x0B,0xFF,0xDA,0x00,0x08,0x01,0x01,0x00,0x00,0x3F,
        0x00,0xFB,0xD3,0xFF,0xD9
    ])

    # If a real image file exists, use it instead
    real_image = None
    for ext in ['.jpg', '.jpeg', '.png']:
        for fname in ['test', 'sample', 'leaf', 'plant', 'crop']:
            path = f"{fname}{ext}"
            if os.path.exists(path):
                real_image = path
                break

    try:
        if real_image:
            print(f"  Using real image: {real_image}")
            with open(real_image, 'rb') as f:
                files = {'file': (real_image, f, 'image/jpeg')}
                resp = requests.post(BACKEND + endpoint, files=files, timeout=30)
        else:
            files = {'file': ('capture.jpg', jpeg_bytes, 'image/jpeg')}
            resp = requests.post(BACKEND + endpoint, files=files, timeout=30)

        if resp.status_code == 200:
            data = resp.json()
            print(f"  ✅ {name}")
            print(f"     Status:     {resp.status_code}")
            print(f"     Response:   {json.dumps(data, indent=6)}")
        else:
            print(f"  ❌ {name} → HTTP {resp.status_code}: {resp.text[:200]}")

    except requests.exceptions.ConnectionError:
        print(f"  ❌ Cannot connect to {BACKEND}")
        print("     Make sure the backend is running (start_all.bat)")
        return False
    except Exception as e:
        print(f"  ❌ Error: {e}")
        return False
    return True

if __name__ == "__main__":
    print("=" * 55)
    print("  Smart Agriculture Backend — Inference Test")
    print("=" * 55)

    # Check if backend is alive
    try:
        health = requests.get(BACKEND + "/api/health", timeout=5)
        print(f"\n✅ Backend reachable — {health.json()}\n")
    except Exception:
        try:
            health = requests.get(BACKEND + "/", timeout=5)
            print(f"\n✅ Backend reachable\n")
        except Exception:
            print(f"\n❌ Backend not reachable at {BACKEND}")
            print("   Run: start_all.bat first\n")
            sys.exit(1)

    print("Testing all models...\n")
    for name, ep in ENDPOINTS.items():
        test_model(name, ep)
        print()

    print("=" * 55)
    print("  Done! Check http://localhost:5173/history for results")
    print("=" * 55)
