"""Contract PDF renderer ([CONTRACT3]) using fpdf2 — same stack as billing/pdf.py.

Renders the generated contract body plus, when signed, a signature block with
the audit trail (signer name, timestamp, IP, drawn signature image).
"""
from __future__ import annotations

import base64
import io
import re
from typing import TYPE_CHECKING

from fpdf import FPDF

if TYPE_CHECKING:
    from app.modules.contracts.models import Contract


def _hex_to_rgb(hex_color: str) -> tuple[int, int, int]:
    h = hex_color.lstrip("#")
    if len(h) == 3:
        h = h[0] * 2 + h[1] * 2 + h[2] * 2
    return int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)


def _latin1(text: str) -> str:
    # Helvetica only covers Latin-1; degrade anything else instead of crashing.
    return text.encode("latin-1", "replace").decode("latin-1")


_SIG_DATA_URL_RE = re.compile(r"^data:image/png;base64,(?P<b64>[A-Za-z0-9+/=]+)$")


def generate_contract_pdf(contract: "Contract", tenant_name: str, primary_color: str | None) -> bytes:
    brand = _hex_to_rgb(primary_color or "#5BA4F5")

    pdf = FPDF(orientation="P", unit="mm", format="A4")
    pdf.set_margins(left=18, top=18, right=18)
    pdf.set_auto_page_break(auto=True, margin=22)
    pdf.add_page()

    # Header — tenant name in brand colour, contract title beneath.
    pdf.set_text_color(*brand)
    pdf.set_font("Helvetica", "B", 11)
    pdf.cell(0, 6, _latin1(tenant_name), new_x="LMARGIN", new_y="NEXT")
    pdf.set_text_color(20, 24, 33)
    pdf.set_font("Helvetica", "B", 17)
    pdf.multi_cell(0, 8, _latin1(contract.title))
    pdf.ln(4)

    # Body — plain paragraphs; blank lines separate them.
    pdf.set_font("Helvetica", "", 10)
    pdf.set_text_color(40, 44, 52)
    for paragraph in (contract.body or "").split("\n"):
        if paragraph.strip():
            pdf.multi_cell(0, 5.5, _latin1(paragraph))
        else:
            pdf.ln(3)

    # Signature block.
    if contract.signed_at:
        pdf.ln(8)
        pdf.set_draw_color(*brand)
        pdf.set_line_width(0.4)
        y = pdf.get_y()
        pdf.line(18, y, 90, y)
        pdf.ln(3)

        image = getattr(contract, "signature_image", None)
        if image:
            match = _SIG_DATA_URL_RE.match(image)
            if match:
                try:
                    png = base64.b64decode(match.group("b64"))
                    pdf.image(io.BytesIO(png), w=45)
                    pdf.ln(2)
                except Exception:
                    pass  # a corrupt drawing must never block the PDF

        pdf.set_font("Helvetica", "B", 10)
        pdf.cell(0, 5.5, _latin1(f"Signed by {contract.signer_name or '-'}"), new_x="LMARGIN", new_y="NEXT")
        pdf.set_font("Helvetica", "", 8.5)
        pdf.set_text_color(110, 116, 128)
        signed = contract.signed_at.strftime("%d-%m-%Y %H:%M UTC")
        pdf.cell(0, 4.5, _latin1(f"Date: {signed}"), new_x="LMARGIN", new_y="NEXT")
        if contract.signer_ip:
            pdf.cell(0, 4.5, _latin1(f"IP address: {contract.signer_ip}"), new_x="LMARGIN", new_y="NEXT")

    out = pdf.output()
    return bytes(out)
