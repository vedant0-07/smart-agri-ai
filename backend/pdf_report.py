"""
PDF report generation using ReportLab.
"""
import os
import json
import uuid
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, Optional

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    HRFlowable, PageBreak
)
from reportlab.lib.enums import TA_CENTER, TA_LEFT

REPORT_DIR = os.getenv("REPORT_DIR", "./reports")
REPORT_TITLE = os.getenv("REPORT_TITLE", "AI-Powered Smart Agriculture Using TinyML Models")

# Color palette
PRIMARY_GREEN = colors.HexColor("#16a34a")
DARK_GREEN = colors.HexColor("#166534")
LIGHT_GREEN = colors.HexColor("#dcfce7")
ACCENT = colors.HexColor("#15803d")
GREY = colors.HexColor("#6b7280")
LIGHT_GREY = colors.HexColor("#f3f4f6")
WHITE = colors.white
BLACK = colors.black


def _get_styles():
    styles = getSampleStyleSheet()
    custom = {
        "title": ParagraphStyle(
            "title", parent=styles["Title"],
            fontSize=20, textColor=DARK_GREEN,
            spaceAfter=6, alignment=TA_CENTER, fontName="Helvetica-Bold"
        ),
        "subtitle": ParagraphStyle(
            "subtitle", parent=styles["Normal"],
            fontSize=11, textColor=GREY,
            spaceAfter=12, alignment=TA_CENTER
        ),
        "section": ParagraphStyle(
            "section", parent=styles["Heading2"],
            fontSize=13, textColor=PRIMARY_GREEN,
            spaceBefore=12, spaceAfter=4, fontName="Helvetica-Bold"
        ),
        "body": ParagraphStyle(
            "body", parent=styles["Normal"],
            fontSize=10, textColor=BLACK, spaceAfter=4
        ),
        "disclaimer": ParagraphStyle(
            "disclaimer", parent=styles["Normal"],
            fontSize=8, textColor=GREY, spaceAfter=4, fontName="Helvetica-Oblique"
        ),
        "label": ParagraphStyle(
            "label", parent=styles["Normal"],
            fontSize=9, textColor=GREY, fontName="Helvetica-Bold"
        ),
        "value": ParagraphStyle(
            "value", parent=styles["Normal"],
            fontSize=10, textColor=BLACK
        ),
        "confidence": ParagraphStyle(
            "confidence", parent=styles["Normal"],
            fontSize=18, textColor=PRIMARY_GREEN,
            spaceAfter=4, fontName="Helvetica-Bold", alignment=TA_CENTER
        ),
    }
    return custom


def generate_pdf_report(
    model_id: str,
    model_display_name: str,
    task_type: str,
    prediction_result: Dict[str, Any],
    input_summary: Dict[str, Any],
    recommendations: Optional[str] = None,
    evaluation_accuracy: Optional[float] = None,
) -> str:
    """Generate a professional PDF report and return the file path."""
    os.makedirs(REPORT_DIR, exist_ok=True)
    timestamp = datetime.now()
    filename = f"report_{model_id}_{timestamp.strftime('%Y%m%d_%H%M%S')}_{uuid.uuid4().hex[:6]}.pdf"
    filepath = os.path.join(REPORT_DIR, filename)

    doc = SimpleDocTemplate(
        filepath,
        pagesize=A4,
        rightMargin=2*cm, leftMargin=2*cm,
        topMargin=2*cm, bottomMargin=2*cm,
    )

    styles = _get_styles()
    story = []

    # ── Header ──────────────────────────────────────────────────────────────────
    story.append(Paragraph(REPORT_TITLE, styles["title"]))
    story.append(Paragraph("Prediction Report", styles["subtitle"]))
    story.append(HRFlowable(width="100%", thickness=2, color=PRIMARY_GREEN, spaceAfter=10))

    # ── Report metadata ──────────────────────────────────────────────────────────
    meta_data = [
        ["Model", model_display_name],
        ["Task", task_type.replace("_", " ").title()],
        ["Report Generated", timestamp.strftime("%Y-%m-%d %H:%M:%S")],
        ["Model ID", model_id],
    ]
    meta_table = Table(meta_data, colWidths=[4*cm, 13*cm])
    meta_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (0, -1), LIGHT_GREEN),
        ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 10),
        ("ROWBACKGROUNDS", (0, 0), (-1, -1), [LIGHT_GREY, WHITE]),
        ("GRID", (0, 0), (-1, -1), 0.5, GREY),
        ("PADDING", (0, 0), (-1, -1), 6),
    ]))
    story.append(meta_table)
    story.append(Spacer(1, 12))

    # ── Prediction Result ────────────────────────────────────────────────────────
    story.append(Paragraph("Prediction Result", styles["section"]))
    story.append(HRFlowable(width="100%", thickness=1, color=LIGHT_GREEN, spaceAfter=6))

    top = prediction_result.get("top_prediction") or {}
    predicted_label = top.get("label") or prediction_result.get("prediction", "N/A")
    confidence = top.get("confidence_percent") or prediction_result.get("confidence_percent")

    if confidence is not None:
        story.append(Paragraph(f"{confidence:.1f}% Confidence", styles["confidence"]))

    result_data = [["Predicted Class", predicted_label]]
    if confidence is not None:
        result_data.append(["Confidence", f"{confidence:.2f}%"])
    if evaluation_accuracy is not None:
        result_data.append(["Model Evaluation Accuracy", f"{evaluation_accuracy:.2f}% (measured on test dataset)"])

    # Irrigation specific
    if "irrigate" in prediction_result:
        result_data.append(["Irrigation Decision", "✓ Irrigate Now" if prediction_result["irrigate"] else "✗ No Irrigation Needed"])
        result_data.append(["Decision Confidence", f"{prediction_result.get('confidence_percent', 0):.2f}%"])

    res_table = Table(result_data, colWidths=[5*cm, 12*cm])
    res_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (0, -1), LIGHT_GREEN),
        ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 10),
        ("GRID", (0, 0), (-1, -1), 0.5, GREY),
        ("PADDING", (0, 0), (-1, -1), 6),
        ("ROWBACKGROUNDS", (0, 0), (-1, -1), [WHITE, LIGHT_GREY]),
    ]))
    story.append(res_table)
    story.append(Spacer(1, 10))

    # ── Top-K Predictions ────────────────────────────────────────────────────────
    top_k = prediction_result.get("top_k_predictions", [])
    if top_k:
        story.append(Paragraph("Top Predictions", styles["section"]))
        tk_data = [["Rank", "Class", "Confidence"]]
        for p in top_k:
            tk_data.append([
                f"#{p.get('rank', '')}",
                p.get("label", ""),
                f"{p.get('confidence_percent', 0):.2f}%"
            ])
        tk_table = Table(tk_data, colWidths=[2*cm, 12*cm, 3*cm])
        tk_table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), PRIMARY_GREEN),
            ("TEXTCOLOR", (0, 0), (-1, 0), WHITE),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, -1), 9),
            ("GRID", (0, 0), (-1, -1), 0.5, GREY),
            ("PADDING", (0, 0), (-1, -1), 5),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [WHITE, LIGHT_GREY]),
            ("ALIGN", (2, 0), (2, -1), "RIGHT"),
        ]))
        story.append(tk_table)
        story.append(Spacer(1, 10))

    # ── Input Summary ────────────────────────────────────────────────────────────
    story.append(Paragraph("Input Summary", styles["section"]))
    if isinstance(input_summary, dict):
        in_data = [[k, str(v)] for k, v in input_summary.items()]
    else:
        in_data = [["Input", str(input_summary)]]

    if in_data:
        in_table = Table(in_data, colWidths=[5*cm, 12*cm])
        in_table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (0, -1), LIGHT_GREEN),
            ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, -1), 9),
            ("GRID", (0, 0), (-1, -1), 0.5, GREY),
            ("PADDING", (0, 0), (-1, -1), 5),
            ("ROWBACKGROUNDS", (0, 0), (-1, -1), [WHITE, LIGHT_GREY]),
        ]))
        story.append(in_table)
        story.append(Spacer(1, 10))

    # ── Recommendations ──────────────────────────────────────────────────────────
    if recommendations:
        story.append(Paragraph("Recommendations", styles["section"]))
        story.append(HRFlowable(width="100%", thickness=1, color=LIGHT_GREEN, spaceAfter=4))
        story.append(Paragraph(str(recommendations), styles["body"]))
        story.append(Spacer(1, 10))

    # ── Disclaimer ───────────────────────────────────────────────────────────────
    story.append(HRFlowable(width="100%", thickness=1, color=GREY, spaceAfter=6))
    disclaimer_text = (
        "⚠ DISCLAIMER: This report is generated by an AI-powered TinyML model and is "
        "intended for decision-support purposes only. Predictions may not be 100% accurate "
        "and should be verified by a qualified agricultural expert before any action is taken. "
        "The model's performance depends on the quality and representativeness of the training "
        "data. Always consult local agricultural extension services for critical decisions."
    )
    story.append(Paragraph(disclaimer_text, styles["disclaimer"]))

    doc.build(story)
    return filepath


def get_report_url(filepath: str, base_url: str = "") -> str:
    filename = os.path.basename(filepath)
    return f"{base_url}/reports/{filename}"
