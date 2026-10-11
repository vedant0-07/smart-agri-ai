"""
AI-Powered Smart Agriculture - FastAPI Backend
Main application entry point
"""
import os
import sys
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from dotenv import load_dotenv

load_dotenv()

# Ensure directories exist
for d in ["models", "uploads", "reports"]:
    os.makedirs(d, exist_ok=True)

from database import init_db
from routers import pest, fertilizer, irrigation, plant_disease, models_admin, reports, history, evaluation

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize DB and model registry on startup."""
    init_db()
    from model_registry import model_registry
    model_registry.initialize()
    yield

app = FastAPI(
    title="AI-Powered Smart Agriculture API",
    description="TinyML-based smart agriculture inference API",
    version="1.0.0",
    lifespan=lifespan,
)

origins = os.getenv("CORS_ORIGINS", "http://localhost:5173,http://localhost:3000").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount static files for generated reports
os.makedirs("reports", exist_ok=True)
app.mount("/reports", StaticFiles(directory="reports"), name="reports")

# Routers
app.include_router(pest.router, prefix="/api/pest", tags=["Pest Detection"])
app.include_router(fertilizer.router, prefix="/api/fertilizer", tags=["Fertilizer Prediction"])
app.include_router(irrigation.router, prefix="/api/irrigation", tags=["Irrigation Prediction"])
app.include_router(plant_disease.router, prefix="/api/plant-disease", tags=["Plant Disease Detection"])
app.include_router(models_admin.router, prefix="/api/models", tags=["Model Management"])
app.include_router(reports.router, prefix="/api/reports", tags=["PDF Reports"])
app.include_router(history.router, prefix="/api/history", tags=["Prediction History"])
app.include_router(evaluation.router, prefix="/api/evaluation", tags=["Model Evaluation"])

# FPGA Camera endpoint (raw RGB565 from OV7670 via ESP-12F)
from fpga_endpoint import router as fpga_router
app.include_router(fpga_router)


@app.get("/health", tags=["Health"])
async def health_check():
    """Health check endpoint."""
    return {"status": "ok", "service": "Smart Agriculture API"}


@app.get("/api/model-status", tags=["Health"])
async def model_status():
    """Returns loading status for all four models."""
    from model_registry import model_registry
    return model_registry.get_all_status()


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host=os.getenv("HOST", "0.0.0.0"),
        port=int(os.getenv("PORT", 8000)),
        reload=os.getenv("DEBUG", "false").lower() == "true",
    )

# ── Serve built React frontend (production) ────────────────────
# Must be LAST — catches all non-API routes and serves index.html
_frontend_dist = os.path.join(os.path.dirname(__file__), "..", "frontend", "dist")
if os.path.isdir(_frontend_dist):
    app.mount("/", StaticFiles(directory=_frontend_dist, html=True), name="frontend")

