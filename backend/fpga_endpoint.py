"""
FPGA Camera Endpoint — accepts raw RGB565 bytes from FPGA/ESP
and runs TFLite pest detection inference.

Endpoint: POST /api/fpga/predict
Body: binary  →  0xAA 0x55 [width_hi] [width_lo] [height_hi] [height_lo] [pixels...]
"""
import io
import time
import logging

import numpy as np
from PIL import Image
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import JSONResponse

from model_registry import model_registry, ModelStatus
from inference import run_image_inference

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/fpga", tags=["FPGA Camera"])


def rgb565_to_jpeg(raw: bytes, width: int, height: int) -> bytes:
    """Convert raw RGB565 bytes → JPEG bytes (for inference pipeline)."""
    if len(raw) < width * height * 2:
        raise ValueError(f"Expected {width*height*2} bytes, got {len(raw)}")

    px = np.frombuffer(raw[:width * height * 2], dtype=np.uint16)
    r = ((px >> 11) & 0x1F).astype(np.uint8) * 8
    g = ((px >> 5)  & 0x3F).astype(np.uint8) * 4
    b = ( px        & 0x1F).astype(np.uint8) * 8

    rgb = np.stack([r, g, b], axis=-1).reshape(height, width, 3)
    img = Image.fromarray(rgb.astype(np.uint8), 'RGB')
    img = img.resize((224, 224), Image.LANCZOS)

    buf = io.BytesIO()
    img.save(buf, format='JPEG', quality=90)
    return buf.getvalue()


@router.post("/predict")
async def fpga_predict(request: Request):
    """
    Accept raw RGB565 binary frame from FPGA/ESP-12F.

    Frame format:
        Byte 0:   0xAA  (magic)
        Byte 1:   0x55  (magic)
        Byte 2-3: width  big-endian uint16
        Byte 4-5: height big-endian uint16
        Byte 6+:  raw RGB565 pixels  (width * height * 2 bytes)
    """
    body = await request.body()

    # Validate header
    if len(body) < 6:
        raise HTTPException(400, "Payload too small — need at least 6 header bytes")
    if body[0] != 0xAA or body[1] != 0x55:
        raise HTTPException(400, f"Bad magic: expected 0xAA 0x55, got {body[0]:02X} {body[1]:02X}")

    width  = (body[2] << 8) | body[3]
    height = (body[4] << 8) | body[5]
    pixels = body[6:]

    logger.info(f"FPGA frame: {width}x{height}, {len(pixels)} pixel bytes")

    # Check model
    model  = model_registry.get("pest_detection")
    config = model_registry.get_config("pest_detection")
    if not model or model.status != ModelStatus.LOADED:
        raise HTTPException(503, "Pest detection model not loaded")

    labels = config.get("labels", [])
    top_k  = config.get("output", {}).get("top_k", 3)

    # Convert RGB565 → JPEG → run inference
    try:
        jpeg_bytes = rgb565_to_jpeg(pixels, width, height)
    except Exception as e:
        raise HTTPException(400, f"Image conversion failed: {e}")

    start = time.time()
    try:
        result = run_image_inference(model.interpreter, jpeg_bytes, labels, top_k)
    except Exception as e:
        raise HTTPException(500, f"Inference failed: {e}")
    elapsed = time.time() - start

    return JSONResponse({
        "source":           "fpga_camera",
        "resolution":       f"{width}x{height}",
        "model":            "pest_detection",
        "inference_time_ms": round(elapsed * 1000, 2),
        "result":           result
    })


@router.get("/status")
async def fpga_status():
    """Health check for FPGA endpoint."""
    model = model_registry.get("pest_detection")
    return {
        "status":       "ready",
        "model_loaded": model is not None and model.status == ModelStatus.LOADED,
        "endpoint":     "POST /api/fpga/predict"
    }
