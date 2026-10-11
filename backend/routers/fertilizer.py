"""
Fertilizer Prediction Router.
Handles one-hot encoding of categorical inputs and numerical inference.

Input: 33 features (6 numerical + 5 soil_type OHE + 22 crop_type OHE)
Output: 19 fertilizer classes

NOTE: The exact feature ordering must match your training pipeline.
If predictions seem wrong, update the fertilizer.json config with your
actual feature column order (as produced by pd.get_dummies() or similar).
"""
import json
import time
import numpy as np
from datetime import datetime
from fastapi import APIRouter, HTTPException, Depends, Request
from pydantic import BaseModel, Field, validator
from sqlalchemy.orm import Session
from typing import Optional

from database import get_db, PredictionRecord
from model_registry import model_registry, ModelStatus
from inference import run_numerical_inference
from pdf_report import generate_pdf_report, get_report_url

router = APIRouter()


class FertilizerInput(BaseModel):
    temperature: float = Field(..., ge=0, le=50, description="Ambient temperature (°C)")
    humidity: float = Field(..., ge=0, le=100, description="Relative humidity (%)")
    moisture: float = Field(..., ge=0, le=100, description="Soil moisture (%)")
    nitrogen: float = Field(..., ge=0, le=140, description="Soil nitrogen (mg/kg)")
    potassium: float = Field(..., ge=0, le=200, description="Soil potassium (mg/kg)")
    phosphorous: float = Field(..., ge=0, le=145, description="Soil phosphorous (mg/kg)")
    soil_type: str = Field(..., description="Soil type (Black, Clayey, Loamy, Red, Sandy)")
    crop_type: str = Field(..., description="Crop type (Barley, Cotton, Ground Nuts, Maize, Millets, Oil Seeds, Paddy, Pulses, Sugarcane, Tobacco, Wheat)")


def build_feature_vector(data: FertilizerInput, config: dict) -> np.ndarray:
    """
    Build a normalized float32 feature vector from the input.
    The vector must match the training pipeline's feature order.

    Default: [temperature_norm, humidity_norm, moisture_norm, nitrogen_norm,
               potassium_norm, phosphorous_norm,
               soil_Black, soil_Clayey, soil_Loamy, soil_Red, soil_Sandy,
               crop_Barley, crop_Cotton, ..., crop_Wheat]
    """
    norm_cfg = config.get("input", {}).get("feature_normalization", {})
    soil_cats = config.get("input", {}).get("soil_type_categories", ["Black", "Clayey", "Loamy", "Red", "Sandy"])
    crop_cats = config.get("input", {}).get("crop_type_categories",
        ["Barley", "Cotton", "Ground Nuts", "Maize", "Millets", "Oil Seeds", "Paddy", "Pulses", "Sugarcane", "Tobacco", "Wheat"])

    def minmax_norm(val, feat_name):
        cfg = norm_cfg.get(feat_name, {})
        lo, hi = cfg.get("min", 0), cfg.get("max", 1)
        return (val - lo) / (hi - lo) if hi != lo else 0.0

    numerical = [
        minmax_norm(data.temperature, "temperature"),
        minmax_norm(data.humidity, "humidity"),
        minmax_norm(data.moisture, "moisture"),
        minmax_norm(data.nitrogen, "nitrogen"),
        minmax_norm(data.potassium, "potassium"),
        minmax_norm(data.phosphorous, "phosphorous"),
    ]

    # One-hot soil type
    soil_ohe = [1.0 if s == data.soil_type else 0.0 for s in soil_cats]

    # One-hot crop type
    crop_ohe = [1.0 if c == data.crop_type else 0.0 for c in crop_cats]

    features = numerical + soil_ohe + crop_ohe
    expected = config.get("input", {}).get("shape", [1, 33])[1]

    if len(features) != expected:
        # Pad or truncate to match
        if len(features) < expected:
            features = features + [0.0] * (expected - len(features))
        else:
            features = features[:expected]

    return np.array(features, dtype=np.float32)


@router.get("/config")
def get_config():
    model = model_registry.get("fertilizer")
    config = model_registry.get_config("fertilizer")
    return {"model_id": "fertilizer", "status": model.status if model else "not_loaded", "config": config}


@router.post("/predict")
async def predict_fertilizer(
    request: Request,
    data: FertilizerInput,
    db: Session = Depends(get_db),
):
    model = model_registry.get("fertilizer")
    if not model or model.status != ModelStatus.LOADED:
        raise HTTPException(503, f"Fertilizer model not loaded. Status: {model.status if model else 'not_found'}")

    config = model_registry.get_config("fertilizer")
    labels = config.get("labels", [])

    # Build feature vector
    try:
        feature_vector = build_feature_vector(data, config)
    except Exception as e:
        raise HTTPException(400, f"Feature vector construction failed: {e}")

    start = time.time()
    try:
        result = run_numerical_inference(
            model.interpreter, feature_vector, labels,
            top_k=3, task_type="classification"
        )
    except Exception as e:
        raise HTTPException(500, f"Inference failed: {str(e)}")
    elapsed = time.time() - start

    top_pred = result.get("top_prediction", {})
    top_label = top_pred.get("label", "")
    fert_recs = config.get("fertilizer_recommendations", {})
    rec_data = fert_recs.get(top_label, {})
    recommendation_text = (
        f"Recommended Fertilizer: {top_label}\n"
        f"Application Rate: {rec_data.get('application_rate', 'N/A')}\n"
        f"Timing: {rec_data.get('timing', 'N/A')}\n"
        f"Nutrients: {rec_data.get('nutrient', 'N/A')}\n"
        f"Caution: {rec_data.get('caution', 'N/A')}"
    ) if rec_data else f"Recommended: {top_label}"

    input_summary = {
        "temperature": f"{data.temperature} °C",
        "humidity": f"{data.humidity} %",
        "moisture": f"{data.moisture} %",
        "nitrogen": f"{data.nitrogen} mg/kg",
        "potassium": f"{data.potassium} mg/kg",
        "phosphorous": f"{data.phosphorous} mg/kg",
        "soil_type": data.soil_type,
        "crop_type": data.crop_type,
    }

    base_url = str(request.base_url).rstrip("/")
    pdf_path = generate_pdf_report(
        model_id="fertilizer",
        model_display_name=config.get("display_name", "Fertilizer Prediction Model"),
        task_type="classification",
        prediction_result=result,
        input_summary=input_summary,
        recommendations=recommendation_text,
    )
    pdf_url = get_report_url(pdf_path, base_url)

    record = PredictionRecord(
        model_id="fertilizer",
        model_display_name=config.get("display_name", "Fertilizer Prediction Model"),
        task_type="classification",
        input_summary=json.dumps(input_summary),
        predicted_label=top_label,
        predicted_class_index=top_pred.get("class_index"),
        confidence_percent=top_pred.get("confidence_percent"),
        top_k_predictions=json.dumps(result.get("top_k_predictions", [])),
        raw_output=json.dumps(result.get("dequantized_output", [])),
        recommendations=recommendation_text,
        report_path=pdf_path,
        report_url=pdf_url,
        inference_success=True,
    )
    db.add(record)
    db.commit()
    db.refresh(record)

    return {
        "prediction_id": record.id,
        "model": "fertilizer",
        "inference_time_ms": round(elapsed * 1000, 2),
        "result": result,
        "recommendation": rec_data,
        "recommendation_text": recommendation_text,
        "report_url": pdf_url,
        "timestamp": datetime.utcnow().isoformat(),
    }
