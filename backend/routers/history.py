"""
Prediction History Router.
"""
import json
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional

from database import get_db, PredictionRecord

router = APIRouter()


def record_to_dict(r: PredictionRecord) -> dict:
    top_k = []
    try:
        top_k = json.loads(r.top_k_predictions) if r.top_k_predictions else []
    except Exception:
        pass
    return {
        "id": r.id,
        "created_at": r.created_at.isoformat() if r.created_at else None,
        "model_id": r.model_id,
        "model_display_name": r.model_display_name,
        "task_type": r.task_type,
        "input_summary": json.loads(r.input_summary) if r.input_summary else {},
        "predicted_label": r.predicted_label,
        "confidence_percent": r.confidence_percent,
        "top_k_predictions": top_k,
        "report_url": r.report_url,
        "inference_success": r.inference_success,
        "error_message": r.error_message,
    }


@router.get("/")
def list_history(
    model_id: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
):
    """List recent prediction history."""
    query = db.query(PredictionRecord).order_by(PredictionRecord.created_at.desc())
    if model_id:
        query = query.filter(PredictionRecord.model_id == model_id)
    total = query.count()
    records = query.offset(offset).limit(limit).all()
    return {
        "total": total,
        "offset": offset,
        "limit": limit,
        "records": [record_to_dict(r) for r in records],
    }


@router.get("/{record_id}")
def get_history_record(record_id: int, db: Session = Depends(get_db)):
    """Get a single prediction record by ID."""
    record = db.query(PredictionRecord).filter(PredictionRecord.id == record_id).first()
    if not record:
        raise HTTPException(404, f"Prediction record {record_id} not found.")
    return record_to_dict(record)


@router.delete("/{record_id}")
def delete_history_record(record_id: int, db: Session = Depends(get_db)):
    """Delete a prediction record."""
    record = db.query(PredictionRecord).filter(PredictionRecord.id == record_id).first()
    if not record:
        raise HTTPException(404, f"Prediction record {record_id} not found.")
    db.delete(record)
    db.commit()
    return {"message": f"Record {record_id} deleted."}
