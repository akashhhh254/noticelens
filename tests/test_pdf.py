import io
from app import app


def make_pdf(text: str) -> bytes:
    stream = f"BT /F1 12 Tf 50 700 Td ({text}) Tj ET"
    pdf = (
        f"%PDF-1.4\n"
        f"1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n"
        f"2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj\n"
        f"3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj\n"
        f"4 0 obj << /Length {len(stream)} >>\n"
        f"stream\n{stream}\nendstream\nendobj\n"
        f"5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj\n"
        f"xref\n0 6\n"
        f"0000000000 65535 f \n"
        f"0000000010 00000 n \n"
        f"0000000060 00000 n \n"
        f"0000000120 00000 n \n"
        f"0000000280 00000 n \n"
        f"0000000350 00000 n \n"
        f"trailer << /Size 6 /Root 1 0 R >>\n"
        f"startxref\n450\n%%EOF"
    )
    return pdf.encode("latin1")


def test_pdf_no_file():
    client = app.test_client()
    resp = client.post("/api/extract-file", data={})
    assert resp.status_code == 400
    assert resp.get_json()["error"] == "Please choose a PDF first."


def test_pdf_wrong_type():
    client = app.test_client()
    data = {"file": (io.BytesIO(b"Hello world"), "test.txt")}
    resp = client.post("/api/extract-file", data=data, content_type="multipart/form-data")
    assert resp.status_code == 400
    assert resp.get_json()["error"] == "Please upload a PDF file."


def test_pdf_scanned_or_short_text():
    client = app.test_client()
    short_pdf = make_pdf("Hi")  # Less than 20 chars
    data = {"file": (io.BytesIO(short_pdf), "notice.pdf")}
    resp = client.post("/api/extract-file", data=data, content_type="multipart/form-data")
    assert resp.status_code == 422
    assert "This PDF looks scanned or has no text." in resp.get_json()["error"]


def test_pdf_too_large():
    client = app.test_client()
    # 5MB + 10 bytes
    large_pdf = b"%PDF-1.4\n" + b"A" * (5 * 1024 * 1024 + 10)
    data = {"file": (io.BytesIO(large_pdf), "big.pdf")}
    resp = client.post("/api/extract-file", data=data, content_type="multipart/form-data")
    assert resp.status_code == 413
    assert "File too large" in resp.get_json()["error"]


def test_pdf_success():
    client = app.test_client()
    notice_text = "Internal Test 2 will be held on 13 Nov 2026 from 10:00 AM to 11:30 AM in Room 204."
    valid_pdf = make_pdf(notice_text)
    data = {"file": (io.BytesIO(valid_pdf), "notice.pdf")}
    resp = client.post("/api/extract-file", data=data, content_type="multipart/form-data")
    assert resp.status_code == 200
    res_data = resp.get_json()
    assert "Internal Test" in res_data["text"]
    assert len(res_data["events"]) >= 1
    evt = res_data["events"][0]
    assert evt["type"] == "test"
    assert evt["date"] == "2026-11-13"
    assert evt["start"] == "10:00"
    assert evt["end"] == "11:30"
