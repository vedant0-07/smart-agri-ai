"""
Plant Disease Detection Router - handles image upload and inference.
"""
import os
import json
import time
from datetime import datetime
from fastapi import APIRouter, UploadFile, File, HTTPException, Depends, Request
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
    model = model_registry.get("plant_disease")
    config = model_registry.get_config("plant_disease")
    return {
        "model_id": "plant_disease",
        "status": model.status if model else "not_loaded",
        "config": config,
    }


@router.post("/predict")
async def predict_plant_disease(
    request: Request,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    """Run plant disease detection inference on an uploaded leaf image."""
    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(400, f"Invalid file type: {file.content_type}.")

    image_bytes = await file.read()
    if len(image_bytes) > MAX_SIZE_MB * 1024 * 1024:
        raise HTTPException(400, f"File too large. Maximum size is {MAX_SIZE_MB} MB.")
    if len(image_bytes) < 100:
        raise HTTPException(400, "File appears to be empty or corrupt.")

    model = model_registry.get("plant_disease")
    if not model or model.status != ModelStatus.LOADED:
        raise HTTPException(503, f"Plant disease model is not loaded. Status: {model.status if model else 'not_found'}")

    config = model_registry.get_config("plant_disease")
    labels = config.get("labels", [])
    top_k = config.get("output", {}).get("top_k", 3)

    start = time.time()
    try:
        result = run_image_inference(model.interpreter, image_bytes, labels, top_k)
    except Exception as e:
        raise HTTPException(500, f"Inference failed: {str(e)}")
    elapsed = time.time() - start

    top_pred = result.get("top_prediction", {})
    top_label = top_pred.get("label", "")
    disease_recs = config.get("disease_recommendations", {})
    recommendation = disease_recs.get(top_label, "Consult an agricultural plant pathologist.")

    base_url = str(request.base_url).rstrip("/")
    input_summary = {
        "filename": file.filename,
        "file_size": f"{len(image_bytes)/1024:.1f} KB",
        "content_type": file.content_type,
    }
    pdf_path = generate_pdf_report(
        model_id="plant_disease",
        model_display_name=config.get("display_name", "Plant Disease Detection Model"),
        task_type="image_classification",
        prediction_result=result,
        input_summary=input_summary,
        recommendations=recommendation,
    )
    pdf_url = get_report_url(pdf_path, base_url)

    record = PredictionRecord(
        model_id="plant_disease",
        model_display_name=config.get("display_name", "Plant Disease Detection Model"),
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
        "model": "plant_disease",
        "inference_time_ms": round(elapsed * 1000, 2),
        "result": result,
        "recommendation": recommendation,
        "report_url": pdf_url,
        "timestamp": datetime.utcnow().isoformat(),
    }
