"""
Evaluation Router - run evaluation metrics on labeled test data.
Supports classification (accuracy, precision, recall, F1, confusion matrix)
and binary regression models.
"""
import json
import numpy as np
from typing import List, Optional
from fastapi import APIRouter, HTTPException, UploadFile, File, Form, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import get_db
from model_registry import model_registry, ModelStatus
from inference import run_image_inference, run_numerical_inference, preprocess_image_int8

router = APIRouter()


class EvaluationRequest(BaseModel):
    model_id: str
    true_labels: List[int]       # Ground truth class indices
    predicted_labels: List[int]  # Model predicted class indices
    class_names: Optional[List[str]] = None


@router.post("/metrics")
def compute_metrics(req: EvaluationRequest):
    """
    Compute classification metrics given true and predicted labels.
    Returns accuracy, per-class precision/recall/F1, and confusion matrix.
    """
    if len(req.true_labels) != len(req.predicted_labels):
        raise HTTPException(400, "true_labels and predicted_labels must have the same length.")
    if len(req.true_labels) == 0:
        raise HTTPException(400, "Labels list must not be empty.")

    try:
        from sklearn.metrics import (
            accuracy_score, precision_score, recall_score,
            f1_score, confusion_matrix, classification_report
        )
    except ImportError:
        raise HTTPException(500, "scikit-learn not installed. Run: pip install scikit-learn")

    y_true = np.array(req.true_labels)
    y_pred = np.array(req.predicted_labels)

    n_classes = max(y_true.max(), y_pred.max()) + 1
    accuracy = float(accuracy_score(y_true, y_pred))
    precision = precision_score(y_true, y_pred, average="weighted", zero_division=0)
    recall = recall_score(y_true, y_pred, average="weighted", zero_division=0)
    f1 = f1_score(y_true, y_pred, average="weighted", zero_division=0)
    cm = confusion_matrix(y_true, y_pred).tolist()

    labels = req.class_names or [str(i) for i in range(n_classes)]
    report = classification_report(
        y_true, y_pred,
        target_names=labels[:n_classes] if len(labels) >= n_classes else None,
        zero_division=0, output_dict=True
    )

    return {
        "model_id": req.model_id,
        "sample_count": len(y_true),
        "accuracy": round(accuracy * 100, 4),
        "weighted_precision": round(float(precision) * 100, 4),
        "weighted_recall": round(float(recall) * 100, 4),
        "weighted_f1": round(float(f1) * 100, 4),
        "confusion_matrix": cm,
        "per_class_report": report,
    }


@router.get("/model/{model_id}/info")
def get_model_eval_info(model_id: str):
    """Return model evaluation info from config."""
    config = model_registry.get_config(model_id)
    if not config:
        raise HTTPException(404, f"Model '{model_id}' not found.")
    return {
        "model_id": model_id,
        "evaluation": config.get("evaluation", {}),
        "task_type": config.get("task_type"),
        "num_classes": len(config.get("labels", [])),
    }
