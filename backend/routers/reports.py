"""
Reports Router - list and serve generated PDF reports.
"""
import os
from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse

router = APIRouter()
REPORT_DIR = os.getenv("REPORT_DIR", "./reports")


@router.get("/")
def list_reports():
    """List all generated PDF reports."""
    if not os.path.exists(REPORT_DIR):
        return {"reports": []}
    files = []
    for fname in sorted(os.listdir(REPORT_DIR), reverse=True):
        if fname.endswith(".pdf"):
            fpath = os.path.join(REPORT_DIR, fname)
            files.append({
                "filename": fname,
                "size_bytes": os.path.getsize(fpath),
                "url": f"/reports/{fname}",
            })
    return {"reports": files}


@router.get("/{filename}")
def download_report(filename: str):
    """Download a specific PDF report."""
    if ".." in filename or "/" in filename or "\\" in filename:
        raise HTTPException(400, "Invalid filename.")
    path = os.path.join(REPORT_DIR, filename)
    if not os.path.exists(path):
        raise HTTPException(404, f"Report '{filename}' not found.")
    return FileResponse(path, media_type="application/pdf", filename=filename)
