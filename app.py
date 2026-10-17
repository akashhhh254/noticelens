import io
import os
from datetime import date
from flask import Flask, jsonify, render_template, request, Response, abort, send_from_directory
import pdfplumber

from notice_lens.extractor import extract_events
from notice_lens.clash import find_clashes
from notice_lens.ics_export import generate_ics
from notice_lens.db import init_db, publish_notice, get_published_notice

# Detect Vercel's read-only serverless environment
IS_VERCEL = bool(os.environ.get("VERCEL") or os.environ.get("VERCEL_ENV"))

app = Flask(__name__, static_folder="static", static_url_path="/static")
app.config["MAX_CONTENT_LENGTH"] = 5 * 1024 * 1024  # 5 MB max upload

@app.route("/static/<path:filename>")
def serve_static(filename):
    static_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "static")
    return send_from_directory(static_dir, filename)

# Initialize database (skip on Vercel — read-only filesystem)
if not IS_VERCEL:
    init_db()


@app.errorhandler(413)
def request_entity_too_large(error):
    return jsonify({"error": "File too large (max 5 MB)."}), 413


@app.route("/")
def index():
    return render_template("index.html", mode="student")


@app.route("/coordinator")
def coordinator():
    if IS_VERCEL:
        return render_template("index.html", mode="student")
    return render_template("index.html", mode="coordinator")


@app.route("/n/<notice_id>")
def view_published(notice_id):
    if IS_VERCEL:
        return render_template("404.html", message="Publishing is not available in the hosted demo. Run locally to use this feature."), 404
    notice = get_published_notice(notice_id)
    if not notice:
        return render_template("404.html", message="Notice not found or expired."), 404
    return render_template("index.html", mode="published", notice=notice)


@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok"})


@app.route("/api/extract", methods=["POST"])
def api_extract():
    if not request.is_json:
        return jsonify({"error": "Invalid or missing JSON."}), 400

    data = request.get_json(silent=True)
    if data is None or "text" not in data:
        return jsonify({"error": "Please paste a notice first."}), 400

    text = data.get("text")
    if not isinstance(text, str) or not text.strip():
        return jsonify({"error": "Please paste a notice first."}), 400

    if len(text) > 20000:
        return jsonify({"error": "This notice is too long. Please paste a shorter one."}), 413

    custom_today = data.get("today")
    if custom_today:
        try:
            today_val = date.fromisoformat(custom_today)
        except ValueError:
            today_val = date.today()
    else:
        today_val = date.today()

    events = extract_events(text, today_val)

    if not events:
        return jsonify({
            "events": [],
            "warnings": ["No dates or times were found. Check that the notice includes a date."]
        }), 200

    return jsonify({
        "events": events,
        "warnings": []
    }), 200


@app.route("/api/extract-file", methods=["POST"])
def api_extract_file():
    if "file" not in request.files:
        return jsonify({"error": "Please choose a PDF first."}), 400

    file = request.files["file"]
    if not file or file.filename == "":
        return jsonify({"error": "Please choose a PDF first."}), 400

    filename = file.filename.lower()
    if not filename.endswith(".pdf"):
        return jsonify({"error": "Please upload a PDF file."}), 400

    # Read bytes and check size
    file_bytes = file.read()
    if len(file_bytes) > 5 * 1024 * 1024:
        return jsonify({"error": "File too large (max 5 MB)."}), 413

    try:
        with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
            pages_text = []
            for page in pdf.pages:
                extracted = page.extract_text()
                if extracted:
                    pages_text.append(extracted)
            full_text = "\n".join(pages_text).strip()
    except Exception:
        return jsonify({"error": "Could not read PDF. Please paste the text instead."}), 422

    if len(full_text) < 20:
        return jsonify({
            "error": "This PDF looks scanned or has no text. Please paste the text instead (image support is planned)."
        }), 422

    today_val = date.today()
    events = extract_events(full_text, today_val)

    warnings = []
    if not events:
        warnings.append("No dates or times were found. Check that the notice includes a date.")

    return jsonify({
        "text": full_text,
        "events": events,
        "warnings": warnings,
    }), 200


@app.route("/api/clashes", methods=["POST"])
def api_clashes():
    if not request.is_json:
        return jsonify({"error": "Invalid or missing JSON."}), 400

    data = request.get_json(silent=True)
    if data is None:
        return jsonify({"error": "Invalid or missing JSON."}), 400

    events = data.get("events", [])
    timetable = data.get("timetable", [])

    result = find_clashes(events, timetable)
    return jsonify(result), 200


@app.route("/api/export", methods=["POST"])
def api_export():
    if not request.is_json:
        return jsonify({"error": "Invalid or missing JSON."}), 400

    data = request.get_json(silent=True)
    if data is None or "events" not in data:
        return jsonify({"error": "Invalid or missing JSON."}), 400

    events = data.get("events", [])
    ics_text, err = generate_ics(events)

    if err:
        return jsonify(err), 400

    return Response(
        ics_text,
        mimetype="text/calendar",
        headers={
            "Content-Disposition": "attachment; filename=notices.ics",
            "Content-Type": "text/calendar; charset=utf-8",
        }
    )


@app.route("/api/publish", methods=["POST"])
def api_publish():
    if IS_VERCEL:
        return jsonify({"error": "Publishing is not available in the hosted demo. Run locally to use this feature."}), 501

    if not request.is_json:
        return jsonify({"error": "Invalid or missing JSON."}), 400

    data = request.get_json(silent=True)
    if not data:
        return jsonify({"error": "Invalid or missing JSON."}), 400

    title = data.get("title", "").strip()
    text = data.get("text", "").strip()
    events = data.get("events", [])

    if not title or not events or not isinstance(events, list) or len(events) == 0:
        return jsonify({"error": "Please provide a title and at least one event."}), 400

    notice_id = publish_notice(title, text, events)
    return jsonify({
        "id": notice_id,
        "url": f"/n/{notice_id}",
    }), 200


@app.route("/api/notice/<notice_id>", methods=["GET"])
def api_get_notice(notice_id):
    if IS_VERCEL:
        return jsonify({"error": "Publishing is not available in the hosted demo."}), 501
    notice = get_published_notice(notice_id)
    if not notice:
        return jsonify({"error": "Notice not found."}), 404
    return jsonify(notice), 200


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, default=int(os.environ.get("PORT", 3000)))
    parser.add_argument("--host", type=str, default=os.environ.get("HOST", "0.0.0.0"))
    args, _ = parser.parse_known_args()
    app.run(host=args.host, port=args.port, debug=False)
