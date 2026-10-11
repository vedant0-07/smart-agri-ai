"""
Model Administration Router - upload, reload, and inspect models.
"""
import os
import shutil
from fastapi import APIRouter, UploadFile, File, HTTPException
from pydantic import BaseModel

from model_registry import model_registry

router = APIRouter()

MODEL_DIR = os.getenv("MODEL_DIR", "./models")
MAX_MODEL_SIZE_MB = int(os.getenv("MAX_MODEL_SIZE_MB", 50))
VALID_MODEL_IDS = ["pest_detection", "fertilizer", "irrigation", "plant_disease"]


@router.get("/status")
def get_all_model_status():
    """Get loading status for all four models."""
    return model_registry.get_all_status()


@router.get("/{model_id}/status")
def get_model_status(model_id: str):
    """Get detailed status for a specific model."""
    model = model_registry.get(model_id)
    if not model:
        raise HTTPException(404, f"Model '{model_id}' not found.")
    return model.to_status_dict()


@router.post("/{model_id}/upload")
async def upload_model(model_id: str, file: UploadFile = File(...)):
    """
    Upload a new .tflite model file for a given model ID.
    The file is saved to the models directory and the model is reloaded.
    """
    if model_id not in VALID_MODEL_IDS:
        raise HTTPException(400, f"Invalid model_id. Must be one of: {VALID_MODEL_IDS}")

    if not file.filename.endswith(".tflite"):
        raise HTTPException(400, "Only .tflite files are accepted.")

    content = await file.read()
    if len(content) > MAX_MODEL_SIZE_MB * 1024 * 1024:
        raise HTTPException(400, f"Model file too large. Maximum {MAX_MODEL_SIZE_MB} MB.")
    if len(content) < 100:
        raise HTTPException(400, "File appears empty or corrupt.")

    os.makedirs(MODEL_DIR, exist_ok=True)
    config = model_registry.get_config(model_id)
    filename = config.get("filename", file.filename)
    dest_path = os.path.join(MODEL_DIR, filename)

    with open(dest_path, "wb") as f:
        f.write(content)

    # Reload
    model = model_registry.reload(model_id, dest_path)

    return {
        "message": f"Model '{model_id}' uploaded and reloaded successfully.",
        "model_id": model_id,
        "filename": filename,
        "size_bytes": len(content),
        "status": model.status,
        "input_details": model.get_input_info(),
        "output_details": model.get_output_info(),
    }


@router.post("/{model_id}/reload")
def reload_model(model_id: str):
    """Reload a model from its configured file path without re-uploading."""
    if model_id not in VALID_MODEL_IDS:
        raise HTTPException(400, f"Invalid model_id. Must be one of: {VALID_MODEL_IDS}")

    config = model_registry.get_config(model_id)
    filename = config.get("filename", "")
    model_path = os.path.join(MODEL_DIR, filename)

    if not os.path.exists(model_path):
        raise HTTPException(404, f"Model file not found at {model_path}. Please upload the model first.")

    model = model_registry.reload(model_id, model_path)
    return {
        "message": f"Model '{model_id}' reloaded.",
        "status": model.status,
        "error": model.error_message,
    }


@router.get("/{model_id}/inspect")
def inspect_model(model_id: str):
    """Inspect a loaded model's tensor details."""
    if model_id not in VALID_MODEL_IDS:
        raise HTTPException(400, f"Invalid model_id.")
    model = model_registry.get(model_id)
    if not model:
        raise HTTPException(404, "Model not found.")
    return {
        "model_id": model_id,
        "status": model.status,
        "input_details": model.get_input_info(),
        "output_details": model.get_output_info(),
        "config": model_registry.get_config(model_id),
    }
