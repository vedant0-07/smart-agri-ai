"""
SQLAlchemy database setup and models.
"""
import os
import json
from datetime import datetime
from sqlalchemy import (
    create_engine, Column, Integer, String, Float,
    DateTime, Text, Boolean
)
from sqlalchemy.orm import declarative_base, sessionmaker

DB_PATH = os.getenv("DB_PATH", "./agri_data.db")
DATABASE_URL = f"sqlite:///{DB_PATH}"

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


class PredictionRecord(Base):
    __tablename__ = "predictions"

    id = Column(Integer, primary_key=True, index=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    model_id = Column(String(64), nullable=False, index=True)
    model_display_name = Column(String(128))
    task_type = Column(String(64))

    # Input summary (JSON string)
    input_summary = Column(Text)

    # Prediction results
    predicted_label = Column(String(256))
    predicted_class_index = Column(Integer, nullable=True)
    confidence_percent = Column(Float, nullable=True)
    top_k_predictions = Column(Text)  # JSON

    # Extras
    raw_output = Column(Text)   # JSON
    recommendations = Column(Text)  # plain text
    report_path = Column(String(512), nullable=True)
    report_url = Column(String(512), nullable=True)
    inference_success = Column(Boolean, default=True)
    error_message = Column(Text, nullable=True)


def init_db():
    Base.metadata.create_all(bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
