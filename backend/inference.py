"""
Inference engine - handles preprocessing and TFLite inference for all model types.

KEY NOTES on INT8 Quantization for these models:
- Image models (pest/plant disease): MobileNetV2 INT8, input scale=1.0 zp=-128
  → preprocessing: uint8_pixel - 128 → int8
  → output: ALREADY softmax probabilities (dequantize directly, NO additional softmax)

- Fertilizer MLP: output is ALREADY softmax probabilities after dequantization
  (confirmed: dequant values sum to ~1.0)

- Irrigation MLP: output is a single logit → sigmoid applied in post-processing

The CRITICAL FIX: DO NOT apply softmax again to models that already include
softmax in their graph. Doing so causes double-softmax which flattens the
distribution and artificially lowers confidence from ~79% to ~10%.
"""
import io
import numpy as np
from PIL import Image
from typing import Any, Dict, List, Optional, Tuple
import logging

logger = logging.getLogger(__name__)

# ───────────────────────────────────────────────────────────────────────────────
# Quantization helpers
# ───────────────────────────────────────────────────────────────────────────────

def quantize_to_int8(value: float, scale: float, zero_point: int) -> int:
    """Quantize a floating-point value to int8 using the model's quant parameters."""
    q = int(round(value / scale)) + zero_point
    return int(np.clip(q, -128, 127))


def dequantize_from_int8(q_value: int, scale: float, zero_point: int) -> float:
    """Dequantize an int8 value back to float."""
    return float((int(q_value) - zero_point) * scale)


def dequantize_array(q_array: np.ndarray, scale: float, zero_point: int) -> np.ndarray:
    """Dequantize an entire int8 array to float32."""
    return (q_array.astype(np.float32) - float(zero_point)) * float(scale)


def _detect_output_type(dq_values: np.ndarray) -> str:
    """
    Heuristically determine whether dequantized output values are already
    probabilities (softmax applied inside model) or raw logits.

    Probabilities: all values in [0, 1] and they sum to approximately 1.0
    Logits: values can be any range, often negative, sum >> 1.
    """
    all_non_negative = bool(np.all(dq_values >= -0.01))
    all_le_one = bool(np.all(dq_values <= 1.01))
    total = float(dq_values.sum())
    sum_near_one = abs(total - 1.0) < 0.15  # allow some quantization error

    if all_non_negative and all_le_one and sum_near_one:
        return "probability"
    return "logit"


# ───────────────────────────────────────────────────────────────────────────────
# Image preprocessing
# ───────────────────────────────────────────────────────────────────────────────

def preprocess_image_int8(image_bytes: bytes, target_size: Tuple[int, int] = (192, 192)) -> np.ndarray:
    """
    Preprocess an image for INT8 MobileNetV2 TFLite models.
    Input quantization: scale=1.0, zero_point=-128
    Formula: int8_val = uint8_val - 128  (maps 0-255 → -128 to 127)
    """
    img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    img = img.resize(target_size, Image.BILINEAR)
    arr = np.array(img, dtype=np.uint8)          # shape (H, W, 3), values 0-255
    arr_int8 = arr.astype(np.int32) - 128        # shift to -128..127
    arr_int8 = np.clip(arr_int8, -128, 127).astype(np.int8)
    return arr_int8[np.newaxis, ...]              # shape (1, H, W, 3)


# ───────────────────────────────────────────────────────────────────────────────
# Output interpretation for INT8 classification
# ───────────────────────────────────────────────────────────────────────────────

def interpret_classification_output(
    raw_output: np.ndarray,
    out_scale: float,
    out_zero_point: int,
    labels: List[str],
    top_k: int = 5,
) -> Dict[str, Any]:
    """
    Dequantize INT8 model output → determine if probabilities or logits
    → extract top-k predictions.

    IMPORTANT: These INT8 TFLite models include softmax inside the graph.
    The dequantized values are already probabilities in [0, 1] summing to ~1.
    Applying softmax again would destroy confidence (double-softmax effect).
    """
    flat = raw_output[0].astype(np.float32)
    dq = dequantize_array(flat, out_scale, out_zero_point)

    # Detect output type: probabilities or logits
    output_type = _detect_output_type(dq)

    if output_type == "probability":
        # Already softmax probabilities — use directly
        probs = np.clip(dq, 0.0, 1.0)
        # Renormalize in case of tiny quantization drift
        prob_sum = probs.sum()
        if prob_sum > 0:
            probs = probs / prob_sum
        # Keep original logits for display (log-scale is more informative)
        display_logits = np.log(np.clip(probs, 1e-10, 1.0))
    else:
        # Raw logits → apply softmax
        logger.info("Output detected as logits, applying softmax.")
        shifted = dq - dq.max()   # numerical stability
        exp_vals = np.exp(shifted)
        probs = exp_vals / exp_vals.sum()
        display_logits = dq

    top_k = min(top_k, len(labels))
    top_indices = np.argsort(probs)[::-1][:top_k]

    predictions = []
    for rank, idx in enumerate(top_indices, 1):
        label = labels[idx] if idx < len(labels) else f"Class_{idx}"
        predictions.append({
            "rank": rank,
            "class_index": int(idx),
            "label": label,
            "confidence": float(probs[idx]),
            "confidence_percent": round(float(probs[idx]) * 100, 2),
        })

    return {
        "top_prediction": predictions[0] if predictions else None,
        "top_k_predictions": predictions,
        "all_logits": display_logits.tolist(),
        "all_probabilities": probs.tolist(),
        "output_interpreted_as": output_type,
    }


# ───────────────────────────────────────────────────────────────────────────────
# Image model inference (pest / plant disease)
# ───────────────────────────────────────────────────────────────────────────────

def run_image_inference(
    interpreter,
    image_bytes: bytes,
    labels: List[str],
    top_k: int = 5,
) -> Dict[str, Any]:
    """Run inference on an image with an INT8 TFLite image classification model."""
    input_details = interpreter.get_input_details()
    output_details = interpreter.get_output_details()

    inp = input_details[0]
    out = output_details[0]

    # Dynamically read input shape
    h, w = inp["shape"][1], inp["shape"][2]
    input_tensor = preprocess_image_int8(image_bytes, target_size=(h, w))

    interpreter.set_tensor(inp["index"], input_tensor)
    interpreter.invoke()

    raw_output = interpreter.get_tensor(out["index"])
    out_scale = float(out["quantization_parameters"]["scales"][0])
    out_zero_point = int(out["quantization_parameters"]["zero_points"][0])

    return interpret_classification_output(raw_output, out_scale, out_zero_point, labels, top_k)


# ───────────────────────────────────────────────────────────────────────────────
# Numerical model inference (fertilizer / irrigation)
# ───────────────────────────────────────────────────────────────────────────────

def quantize_feature_vector(
    features: np.ndarray,
    inp_scale: float,
    inp_zero_point: int,
) -> np.ndarray:
    """Quantize a float feature vector to INT8."""
    q = np.round(features / inp_scale).astype(np.int32) + inp_zero_point
    return np.clip(q, -128, 127).astype(np.int8)


def run_numerical_inference(
    interpreter,
    feature_vector: np.ndarray,
    labels: Optional[List[str]] = None,
    top_k: int = 5,
    task_type: str = "classification",
) -> Dict[str, Any]:
    """Run inference on a numerical feature vector."""
    input_details = interpreter.get_input_details()
    output_details = interpreter.get_output_details()

    inp = input_details[0]
    out = output_details[0]

    inp_scale = float(inp["quantization_parameters"]["scales"][0])
    inp_zero_point = int(inp["quantization_parameters"]["zero_points"][0])
    out_scale = float(out["quantization_parameters"]["scales"][0])
    out_zero_point = int(out["quantization_parameters"]["zero_points"][0])

    expected_n = inp["shape"][1]
    if len(feature_vector) != expected_n:
        raise ValueError(
            f"Feature vector length {len(feature_vector)} ≠ model expected {expected_n}."
        )

    q_features = quantize_feature_vector(feature_vector, inp_scale, inp_zero_point)
    q_features = q_features[np.newaxis, :]

    interpreter.set_tensor(inp["index"], q_features)
    interpreter.invoke()

    raw_output = interpreter.get_tensor(out["index"])
    dq_output = dequantize_array(raw_output[0], out_scale, out_zero_point)

    if task_type == "binary":
        # Single sigmoid output
        raw_val = float(dq_output[0])
        sigmoid_val = float(1.0 / (1.0 + np.exp(-raw_val)))
        irrigate = sigmoid_val >= 0.5
        confidence = sigmoid_val if irrigate else (1.0 - sigmoid_val)
        return {
            "task_type": "binary",
            "raw_dequantized": raw_val,
            "sigmoid_probability": sigmoid_val,
            "prediction": "Irrigate" if irrigate else "No Irrigation Needed",
            "confidence_percent": round(confidence * 100, 2),
            "irrigate": irrigate,
        }

    elif task_type == "classification" and labels:
        return interpret_classification_output(raw_output, out_scale, out_zero_point, labels, top_k)

    else:
        return {
            "task_type": task_type,
            "raw_output": raw_output.tolist(),
            "dequantized_output": dq_output.tolist(),
        }
