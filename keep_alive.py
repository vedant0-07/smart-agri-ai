"""
keep_alive.py — Prevents Render free tier from sleeping
Run this locally or on any always-on machine/cron service

Usage:
  python keep_alive.py https://smart-agri-ai.onrender.com

Or use cron every 14 minutes:
  */14 * * * * curl https://smart-agri-ai.onrender.com/health
"""
import requests
import time
import sys

URL = sys.argv[1] if len(sys.argv) > 1 else "https://smart-agri-ai.onrender.com"
INTERVAL = 14 * 60  # 14 minutes

print(f"Keeping {URL} awake (ping every 14 min)...")
while True:
    try:
        r = requests.get(f"{URL}/health", timeout=10)
        print(f"[OK] {r.status_code} — {time.strftime('%H:%M:%S')}")
    except Exception as e:
        print(f"[WARN] {e}")
    time.sleep(INTERVAL)
