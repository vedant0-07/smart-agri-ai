"""
esp32_push.py — Push AI result to ESP32 display bridge
Call push_result_to_esp32() after any inference completes.
"""
import os
import threading
import requests
import logging

log = logging.getLogger(__name__)

# Set ESP32_IP in your .env file or environment
# e.g. ESP32_IP=192.168.1.25
ESP32_IP   = os.getenv("ESP32_IP", "")
ESP32_PORT = int(os.getenv("ESP32_PORT", "80"))


def push_result_to_esp32(label: str, confidence_percent: float):
    """Fire-and-forget POST to ESP32 with AI result."""
    if not ESP32_IP:
        return   # not configured — skip silently

    url = f"http://{ESP32_IP}:{ESP32_PORT}/result"
    payload = {
        "label": label[:20],
        "confidence_percent": int(confidence_percent),
    }

    def _send():
        try:
            r = requests.post(url, json=payload, timeout=3)
            if r.status_code == 200:
                log.info(f"ESP32 display updated: {label} {confidence_percent:.0f}%")
            else:
                log.warning(f"ESP32 returned {r.status_code}")
        except requests.exceptions.ConnectionError:
            log.debug("ESP32 not reachable (not connected?)")
        except Exception as e:
            log.debug(f"ESP32 push error: {e}")

    # Run in background so it never delays the API response
    threading.Thread(target=_send, daemon=True).start()
