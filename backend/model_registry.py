"""
Model Registry - Manages loading and status of all TFLite models.
"""
import os
import json
import logging
from pathlib import Path
from typing import Dict, Optional, Any
from enum import Enum

logger = logging.getLogger(__name__)

MODEL_DIR = os.getenv("MODEL_DIR", "./models")
CONFIG_DIR = "./config"


class ModelStatus(str, Enum):
    NOT_LOADED = "not_loaded"
    LOADING = "loading"
    LOADED = "loaded"
    ERROR = "error"


class TFLiteModel:
    """Wraps a TFLite interpreter with metadata."""

    def __init__(self, model_id: str, config: dict):
        self.model_id = model_id
        self.config = config
        self.interpreter = None
        self.status = ModelStatus.NOT_LOADED
        self.error_message: Optional[str] = None
        self.input_details = None
        self.output_details = None

    def load(self, model_path: str):
        self.status = ModelStatus.LOADING
        try:
            try:
                import tensorflow as tf
                self.interpreter = tf.lite.Interpreter(model_path=model_path)
            except (ImportError, AttributeError):
                import tflite_runtime.interpreter as tflite
                self.interpreter = tflite.Interpreter(model_path=model_path)

            self.interpreter.allocate_tensors()
            self.input_details = self.interpreter.get_input_details()
            self.output_details = self.interpreter.get_output_details()
            self.status = ModelStatus.LOADED
            self.error_message = None
            logger.info(f"Model '{self.model_id}' loaded successfully from {model_path}")
        except Exception as e:
            self.status = ModelStatus.ERROR
            self.error_message = str(e)
            logger.error(f"Failed to load model '{self.model_id}': {e}")

    def get_input_info(self):
        if not self.input_details:
            return []
        return [
            {
                "name": t["name"],
                "shape": t["shape"].tolist(),
                "dtype": t["dtype"].__name__,
                "quantization": {
                    "scales": t["quantization_parameters"]["scales"].tolist(),
                    "zero_points": t["quantization_parameters"]["zero_points"].tolist(),
                },
            }
            for t in self.input_details
        ]

    def get_output_info(self):
        if not self.output_details:
            return []
        return [
            {
                "name": t["name"],
                "shape": t["shape"].tolist(),
                "dtype": t["dtype"].__name__,
                "quantization": {
                    "scales": t["quantization_parameters"]["scales"].tolist(),
                    "zero_points": t["quantization_parameters"]["zero_points"].tolist(),
                },
            }
            for t in self.output_details
        ]

    def to_status_dict(self):
        return {
            "model_id": self.model_id,
            "display_name": self.config.get("display_name", self.model_id),
            "status": self.status,
            "error": self.error_message,
            "filename": self.config.get("filename"),
            "task_type": self.config.get("task_type"),
            "input_details": self.get_input_info(),
            "output_details": self.get_output_info(),
        }


class ModelRegistry:
    """Singleton registry for all four agricultural TFLite models."""

    MODEL_IDS = ["pest_detection", "fertilizer", "irrigation", "plant_disease"]

    def __init__(self):
        self._models: Dict[str, TFLiteModel] = {}
        self._configs: Dict[str, dict] = {}

    def _load_config(self, model_id: str) -> dict:
        config_path = Path(CONFIG_DIR) / f"{model_id}.json"
        if config_path.exists():
            with open(config_path, "r") as f:
                return json.load(f)
        return {"model_id": model_id, "display_name": model_id}

    def initialize(self):
        """Load all four models from the model directory."""
        for model_id in self.MODEL_IDS:
            config = self._load_config(model_id)
            self._configs[model_id] = config
            model = TFLiteModel(model_id, config)
            self._models[model_id] = model

            # Try loading from MODEL_DIR
            filename = config.get("filename", "")
            if filename:
                model_path = os.path.join(MODEL_DIR, filename)
                if os.path.exists(model_path):
                    model.load(model_path)
                else:
                    model.status = ModelStatus.NOT_LOADED
                    model.error_message = f"Model file not found: {model_path}"
                    logger.warning(f"Model file not found: {model_path}")

    def get(self, model_id: str) -> Optional[TFLiteModel]:
        return self._models.get(model_id)

    def get_config(self, model_id: str) -> dict:
        return self._configs.get(model_id, {})

    def reload(self, model_id: str, model_path: str):
        """Reload a single model from a new path."""
        config = self._configs.get(model_id, {})
        model = TFLiteModel(model_id, config)
        model.load(model_path)
        self._models[model_id] = model
        return model

    def get_all_status(self) -> dict:
        return {
            mid: m.to_status_dict() for mid, m in self._models.items()
        }


model_registry = ModelRegistry()
