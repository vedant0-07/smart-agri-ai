# AI-Powered Smart Agriculture Using TinyML Models

A final-year engineering project demonstrating real TFLite inference for agricultural AI.

## Models

| Model | File | Input | Output |
|-------|------|-------|--------|
| Pest Detection | `ip102_mobilenetv2_192_stage3_int8.tflite` | 192×192 RGB INT8 | 102 classes |
| Plant Disease | `plantvillage_mobilenetv2_192_stage2_int8.tflite` | 192×192 RGB INT8 | 38 classes |
| Fertilizer | `fertilizer_mlp_int8.tflite` | 33 features INT8 | 19 classes |
| Irrigation | `irrigation_model_int8.tflite` | 13 features INT8 | Binary (sigmoid) |

## Project Structure

```
smart-agri-app/
├── backend/
│   ├── main.py              # FastAPI app entry point
│   ├── model_registry.py    # TFLite model loader
│   ├── inference.py         # INT8 quantization & inference engine
│   ├── database.py          # SQLite prediction history
│   ├── pdf_report.py        # ReportLab PDF generation
│   ├── config/              # Model configs (labels, preprocessing)
│   │   ├── pest_detection.json
│   │   ├── plant_disease.json
│   │   ├── fertilizer.json
│   │   └── irrigation.json
│   ├── models/              # TFLite model files (copy yours here)
│   ├── uploads/             # Temporary image uploads
│   ├── reports/             # Generated PDF reports
│   └── routers/             # API route handlers
└── frontend/
    ├── src/
    │   ├── pages/           # React page components
    │   ├── components/      # Reusable UI components
    │   ├── utils/api.ts     # Axios API client
    │   └── types/api.ts     # TypeScript types
    └── package.json
```

## Setup & Installation

### 1. Copy Model Files

Copy your `.tflite` model files to `backend/models/`:

```
backend/models/
├── ip102_mobilenetv2_192_stage3_int8.tflite
├── plantvillage_mobilenetv2_192_stage2_int8.tflite
├── fertilizer_mlp_int8.tflite
└── irrigation_model_int8.tflite
```

### 2. Backend Setup

```powershell
cd backend

# Create virtual environment (optional but recommended)
python -m venv venv
venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Copy and configure environment
copy .env.example .env

# Start the server
python main.py
```

The backend will start on **http://localhost:8000**

### 3. Frontend Setup

```powershell
cd frontend

# Install dependencies
npm install --legacy-peer-deps

# Start development server
npm run dev
```

The frontend will start on **http://localhost:5173**

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check |
| `/api/model-status` | GET | All model status |
| `/api/pest/predict` | POST | Pest detection (image) |
| `/api/plant-disease/predict` | POST | Plant disease (image) |
| `/api/fertilizer/predict` | POST | Fertilizer recommendation (JSON) |
| `/api/irrigation/predict` | POST | Irrigation decision (JSON) |
| `/api/history/` | GET | Prediction history |
| `/api/reports/` | GET | List PDF reports |
| `/docs` | GET | Interactive API docs (Swagger) |

## Configuration

Each model has a JSON config in `backend/config/`. To update class labels or feature ordering:

1. Open `backend/config/<model_id>.json`
2. Update the `labels` array to match your training labels
3. For fertilizer/irrigation: update `feature_order_description` with your exact feature columns
4. Restart the backend

> ⚠️ **Important**: The fertilizer model expects 33 features built from one-hot encoding.
> If the default feature ordering doesn't match your training, update `backend/config/fertilizer.json`
> with the exact column order from `pd.get_dummies()` output in your training notebook.

## Notes on Model Accuracy

- Pest Detection: 102-class IP102 benchmark dataset, MobileNetV2
- Plant Disease: 38-class PlantVillage dataset, MobileNetV2
- Fertilizer: 19-class output, 33 one-hot encoded features
- Irrigation: Binary sigmoid output (irrigate/no irrigation)

All inference is **real TFLite inference** with correct INT8 dequantization.
No simulated or hardcoded predictions are used.

## PDF Reports

Reports are automatically generated after each prediction and stored in `backend/reports/`.
They include prediction results, confidence scores, recommendations, and a disclaimer.

## Disclaimer

AI predictions are decision-support tools and must be verified by qualified agricultural experts
before any critical decisions are made.
