"""
Irrigation Prediction Router.
Handles numerical feature input and binary classification inference.

Input: 13 features (likely: numerical + one-hot crop type)
Output: 1 binary value (irrigate=1 / no irrigation=0) via sigmoid
"""
import json
import time
import numpy as np
from datetime import datetime
from fastapi import APIRouter, HTTPException, Depends, Request
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from database import get_db, PredictionRecord
from model_registry import model_registry, ModelStatus
from inference import run_numerical_inference
from pdf_report import generate_pdf_report, get_report_url

router = APIRouter()


class IrrigationInput(BaseModel):
    crop_type: str = Field(..., description="Crop type")
    soil_moisture: float = Field(..., ge=0, le=100, description="Soil moisture (%)")
    temperature: float = Field(..., ge=0, le=50, description="Temperature (°C)")
    humidity: float = Field(..., ge=0, le=100, description="Humidity (%)")
    water_requirement: float = Field(default=5.0, ge=0, le=20, description="Daily water requirement (mm/day)")


def build_irrigation_vector(data: IrrigationInput, config: dict) -> np.ndarray:
    """
    Build 13-feature vector. Default assumption:
    [soil_moisture_norm, temperature_norm, humidity_norm, water_req_norm,
     zero_pad,
     crop_Wheat, crop_Maize, crop_Sugarcane, crop_Cotton, crop_Paddy,
     crop_Barley, crop_Millets, crop_Other]
    = 4 numerical + 1 pad + 8 crop OHE = 13

    Update if your training features differ.
    """
    norm_cfg = config.get("input", {}).get("feature_normalization", {})
    crop_cats = config.get("input", {}).get("crop_type_categories",
        ["Wheat", "Maize", "Sugarcane", "Cotton", "Paddy", "Barley", "Millets", "Other"])

    def norm(val, mn, mx):
        return (val - mn) / (mx - mn) if mx != mn else 0.0

    sm_cfg = norm_cfg.get("soil_moisture", {"min": 0, "max": 100})
    tmp_cfg = norm_cfg.get("temperature", {"min": 0, "max": 50})
    hum_cfg = norm_cfg.get("humidity", {"min": 0, "max": 100})
    wr_cfg = norm_cfg.get("water_requirement", {"min": 0, "max": 20})

    numerical = [
        norm(data.soil_moisture, sm_cfg["min"], sm_cfg["max"]),
        norm(data.temperature, tmp_cfg["min"], tmp_cfg["max"]),
        norm(data.humidity, hum_cfg["min"], hum_cfg["max"]),
        norm(data.water_requirement, wr_cfg["min"], wr_cfg["max"]),
        0.0,  # padding / extra feature
    ]

    # One-hot crop type (8 categories)
    crop_ohe = [1.0 if c == data.crop_type else 0.0 for c in crop_cats]

    features = numerical + crop_ohe
    expected = config.get("input", {}).get("shape", [1, 13])[1]

    if len(features) < expected:
        features = features + [0.0] * (expected - len(features))
    elif len(features) > expected:
        features = features[:expected]

    return np.array(features, dtype=np.float32)


@router.get("/config")
def get_config():
    model = model_registry.get("irrigation")
    config = model_registry.get_config("irrigation")
    return {"model_id": "irrigation", "status": model.status if model else "not_loaded", "config": config}


@router.post("/predict")
async def predict_irrigation(
    request: Request,
    data: IrrigationInput,
    db: Session = Depends(get_db),
):
    model = model_registry.get("irrigation")
    if not model or model.status != ModelStatus.LOADED:
        raise HTTPException(503, f"Irrigation model not loaded. Status: {model.status if model else 'not_found'}")

    config = model_registry.get_config("irrigation")

    try:
        feature_vector = build_irrigation_vector(data, config)
    except Exception as e:
        raise HTTPException(400, f"Feature vector construction failed: {e}")

    start = time.time()
    try:
        result = run_numerical_inference(
            model.interpreter, feature_vector,
            task_type="binary"
        )
    except Exception as e:
        raise HTTPException(500, f"Inference failed: {str(e)}")
    elapsed = time.time() - start

    guidance_cfg = config.get("irrigation_guidance", {})
    key = "irrigate" if result.get("irrigate") else "no_irrigation"
    guidance = guidance_cfg.get(key, {})
    rec_text = guidance.get("message", result.get("prediction", ""))

    input_summary = {
        "crop_type": data.crop_type,
        "soil_moisture": f"{data.soil_moisture} %",
        "temperature": f"{data.temperature} °C",
        "humidity": f"{data.humidity} %",
        "water_requirement": f"{data.water_requirement} mm/day",
    }

    base_url = str(request.base_url).rstrip("/")
    pdf_path = generate_pdf_report(
        model_id="irrigation",
        model_display_name=config.get("display_name", "Irrigation Prediction Model"),
        task_type="binary_classification",
        prediction_result=result,
        input_summary=input_summary,
        recommendations=rec_text + "\n\nActions:\n" + "\n".join(f"• {a}" for a in guidance.get("actions", [])),
    )
    pdf_url = get_report_url(pdf_path, base_url)

    record = PredictionRecord(
        model_id="irrigation",
        model_display_name=config.get("display_name", "Irrigation Prediction Model"),
        task_type="binary_classification",
        input_summary=json.dumps(input_summary),
        predicted_label=result.get("prediction", ""),
        confidence_percent=result.get("confidence_percent"),
        top_k_predictions=None,
        raw_output=json.dumps({"raw_dequantized": result.get("raw_dequantized"), "sigmoid": result.get("sigmoid_probability")}),
        recommendations=rec_text,
        report_path=pdf_path,
        report_url=pdf_url,
        inference_success=True,
    )
    db.add(record)
    db.commit()
    db.refresh(record)

    return {
        "prediction_id": record.id,
        "model": "irrigation",
        "inference_time_ms": round(elapsed * 1000, 2),
        "result": result,
        "guidance": guidance,
        "report_url": pdf_url,
        "timestamp": datetime.utcnow().isoformat(),
    }
