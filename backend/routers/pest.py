"""
Pest Detection Router - handles image upload and inference.
"""
import os
import json
import time
from datetime import datetime
from fastapi import APIRouter, UploadFile, File, HTTPException, Depends, Request
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from database import get_db, PredictionRecord
from model_registry import model_registry, ModelStatus
from inference import run_image_inference
from pdf_report import generate_pdf_report, get_report_url

router = APIRouter()

ALLOWED_TYPES = {"image/jpeg", "image/jpg", "image/png", "image/webp", "image/bmp"}
MAX_SIZE_MB = int(os.getenv("MAX_IMAGE_SIZE_MB", 10))


@router.get("/config")
def get_config():
    """Return model configuration including labels."""
    model = model_registry.get("pest_detection")
    config = model_registry.get_config("pest_detection")
    return {
        "model_id": "pest_detection",
        "status": model.status if model else "not_loaded",
        "config": config,
    }


@router.post("/predict")
async def predict_pest(
    request: Request,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    """Run pest detection inference on an uploaded image."""
    # Validate
    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(400, f"Invalid file type: {file.content_type}. Must be JPEG, PNG, WebP, or BMP.")

    image_bytes = await file.read()
    if len(image_bytes) > MAX_SIZE_MB * 1024 * 1024:
        raise HTTPException(400, f"File too large. Maximum size is {MAX_SIZE_MB} MB.")
    if len(image_bytes) < 100:
        raise HTTPException(400, "File appears to be empty or corrupt.")

    # Check model
    model = model_registry.get("pest_detection")
    if not model or model.status != ModelStatus.LOADED:
        raise HTTPException(503, f"Pest detection model is not loaded. Status: {model.status if model else 'not_found'}")

    config = model_registry.get_config("pest_detection")
    labels = config.get("labels", [])
    top_k = config.get("output", {}).get("top_k", 3)

    # Run inference
    start = time.time()
    try:
        result = run_image_inference(model.interpreter, image_bytes, labels, top_k)
    except Exception as e:
        raise HTTPException(500, f"Inference failed: {str(e)}")
    elapsed = time.time() - start

    # Build recommendation
    top_pred = result.get("top_prediction", {})
    top_label = top_pred.get("label", "")
    recommendations_db = config.get("pest_recommendations", {})
    recommendation = (
        recommendations_db.get(top_label.lower())
        or recommendations_db.get("default", "Consult an agricultural expert.")
    )

    # Generate PDF
    base_url = str(request.base_url).rstrip("/")
    input_summary = {
        "filename": file.filename,
        "file_size": f"{len(image_bytes)/1024:.1f} KB",
        "content_type": file.content_type,
    }
    pdf_path = generate_pdf_report(
        model_id="pest_detection",
        model_display_name=config.get("display_name", "Pest Detection Model"),
        task_type="image_classification",
        prediction_result=result,
        input_summary=input_summary,
        recommendations=recommendation,
    )
    pdf_url = get_report_url(pdf_path, base_url)

    # Save to DB
    record = PredictionRecord(
        model_id="pest_detection",
        model_display_name=config.get("display_name", "Pest Detection Model"),
        task_type="image_classification",
        input_summary=json.dumps(input_summary),
        predicted_label=top_label,
        predicted_class_index=top_pred.get("class_index"),
        confidence_percent=top_pred.get("confidence_percent"),
        top_k_predictions=json.dumps(result.get("top_k_predictions", [])),
        raw_output=json.dumps({"all_logits_sample": result.get("all_logits", [])[:5]}),
        recommendations=recommendation,
        report_path=pdf_path,
        report_url=pdf_url,
        inference_success=True,
    )
    db.add(record)
    db.commit()
    db.refresh(record)

    return {
        "prediction_id": record.id,
        "model": "pest_detection",
        "inference_time_ms": round(elapsed * 1000, 2),
        "result": result,
        "recommendation": recommendation,
        "report_url": pdf_url,
        "timestamp": datetime.utcnow().isoformat(),
    }
