import express, { Request, Response, NextFunction } from "express";
import path from "node:path";
import fs from "node:fs";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import multer from "multer";
import nunjucks from "nunjucks";
import cors from "cors";

const require = createRequire(import.meta.url);
const pdfParse = require("pdf-parse");
const QRCode = require("qrcode");

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Try importing node:sqlite for native SQLite support
let db: any = null;
try {
  const sqlite = await import("node:sqlite");
  const DatabaseSync = (sqlite as any).DatabaseSync;
  if (DatabaseSync) {
    const dbPath = path.join(__dirname, "noticelens.db");
    db = new DatabaseSync(dbPath);
    db.exec(`
      CREATE TABLE IF NOT EXISTS published_notices (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        text TEXT NOT NULL,
        events_json TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
  }
} catch (err) {
  console.warn("node:sqlite unavailable, using in-memory fallback:", err);
}

// In-memory fallback if sqlite is unavailable
const memoryNotices = new Map<string, any>();

function savePublishedNotice(id: string, title: string, text: string, events: any[]): void {
  const now = new Date().toISOString();
  if (db) {
    try {
      const stmt = db.prepare(
        "INSERT INTO published_notices (id, title, text, events_json, created_at) VALUES (?, ?, ?, ?, ?)"
      );
      stmt.run(id, title, text, JSON.stringify(events), now);
      return;
    } catch (e) {
      console.error("DB insert error, falling back to memory:", e);
    }
  }
  memoryNotices.set(id, {
    id,
    title,
    text,
    events,
    created_at: now,
  });
}

function getPublishedNotice(id: string): any | null {
  if (db) {
    try {
      const stmt = db.prepare("SELECT id, title, text, events_json, created_at FROM published_notices WHERE id = ?");
      const row: any = stmt.get(id);
      if (row) {
        return {
          id: row.id,
          title: row.title,
          text: row.text,
          events: JSON.parse(row.events_json),
          created_at: row.created_at,
        };
      }
    } catch (e) {
      console.error("DB get error:", e);
    }
  }
  return memoryNotices.get(id) || null;
}

function generateRandomId(length = 8): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Helper to invoke python rule engine CLI
function runLensCli(action: string, payload: any): Promise<any> {
  return new Promise((resolve, reject) => {
    const cliScript = path.join(__dirname, "scripts", "lens_cli.py");
    const pyProc = spawn("python3", [cliScript], {
      cwd: __dirname,
      env: { ...process.env, PYTHONUNBUFFERED: "1" },
    });

    let stdout = "";
    let stderr = "";

    pyProc.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    pyProc.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    pyProc.on("close", (code) => {
      if (code !== 0 && !stdout) {
        return reject(new Error(stderr || `CLI exited with code ${code}`));
      }
      try {
        const parsed = JSON.parse(stdout);
        resolve(parsed);
      } catch (err) {
        reject(new Error(`Failed to parse CLI output: ${stdout || stderr}`));
      }
    });

    pyProc.stdin.write(JSON.stringify({ action, payload }));
    pyProc.stdin.end();
  });
}

const app = express();
const upload = multer({
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
});

// Configure Nunjucks
const env = nunjucks.configure(path.join(__dirname, "templates"), {
  autoescape: true,
  express: app,
  noCache: true,
});

// Add custom filter `tojson` for Jinja2 compatibility
env.addFilter("tojson", (obj: any) => {
  return (nunjucks.runtime as any).markSafe(JSON.stringify(obj));
});

app.use(cors());
app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: true, limit: "5mb" }));

// Static files
app.use("/static", express.static(path.join(__dirname, "static")));
app.use("/static", express.static(path.join(__dirname, "public", "static")));
app.use(express.static(path.join(__dirname, "public")));
app.use(express.static(path.join(__dirname, "static")));

// Error handler for 413
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  if (err && (err.code === "LIMIT_FILE_SIZE" || err.type === "entity.too.large" || err.status === 413)) {
    return res.status(413).json({ error: "File too large (max 5 MB)." });
  }
  next(err);
});

// Routes
app.get("/", (req: Request, res: Response) => {
  res.render("index.html", { mode: "student" });
});

app.get("/coordinator", (req: Request, res: Response) => {
  res.render("index.html", { mode: "coordinator" });
});

app.get("/n/:notice_id", (req: Request, res: Response) => {
  const noticeId = Array.isArray(req.params.notice_id) ? req.params.notice_id[0] : req.params.notice_id;
  const notice = getPublishedNotice(noticeId);
  if (!notice) {
    return res.status(404).render("404.html", { message: "Notice not found or expired." });
  }
  res.render("index.html", { mode: "published", notice });
});

app.get("/health", (req: Request, res: Response) => {
  res.json({ status: "ok" });
});

// API: Extract from text
app.post("/api/extract", async (req: Request, res: Response) => {
  const text = req.body?.text;
  if (!text || typeof text !== "string" || !text.trim()) {
    return res.status(400).json({ error: "Please paste a notice first." });
  }

  if (text.length > 20000) {
    return res.status(413).json({ error: "This notice is too long. Please paste a shorter one." });
  }

  try {
    const result = await runLensCli("extract", {
      text,
      today: req.body?.today || null,
    });
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to extract events." });
  }
});

// API: Extract from PDF file
app.post("/api/extract-file", upload.single("file"), async (req: Request, res: Response) => {
  if (!req.file) {
    return res.status(400).json({ error: "Please choose a PDF first." });
  }

  const filename = req.file.originalname.toLowerCase();
  if (!filename.endsWith(".pdf")) {
    return res.status(400).json({ error: "Please upload a PDF file." });
  }

  try {
    const data = await pdfParse(req.file.buffer);
    const fullText = (data.text || "").trim();

    if (fullText.length < 20) {
      return res.status(422).json({
        error: "This PDF looks scanned or has no text. Please paste the text instead (image support is planned).",
      });
    }

    const result = await runLensCli("extract", {
      text: fullText,
      today: null,
    });

    res.json({
      text: fullText,
      events: result.events || [],
      warnings: result.warnings || [],
    });
  } catch (err: any) {
    res.status(422).json({ error: "Could not read PDF. Please paste the text instead." });
  }
});

// API: Clashes
app.post("/api/clashes", async (req: Request, res: Response) => {
  const events = req.body?.events || [];
  const timetable = req.body?.timetable || [];

  try {
    const result = await runLensCli("clashes", { events, timetable });
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to check clashes." });
  }
});

// API: Export ICS
app.post("/api/export", async (req: Request, res: Response) => {
  const events = req.body?.events;
  if (!events || !Array.isArray(events)) {
    return res.status(400).json({ error: "Invalid or missing JSON." });
  }

  try {
    const result = await runLensCli("export", { events });
    if (result.error) {
      return res.status(400).json(result.error);
    }
    res.setHeader("Content-Type", "text/calendar; charset=utf-8");
    res.setHeader("Content-Disposition", "attachment; filename=notices.ics");
    res.send(result.ics);
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to generate calendar." });
  }
});

// API: Publish Notice
app.post("/api/publish", (req: Request, res: Response) => {
  const title = (req.body?.title || "").trim();
  const text = (req.body?.text || "").trim();
  const events = req.body?.events;

  if (!title || !events || !Array.isArray(events) || events.length === 0) {
    return res.status(400).json({ error: "Please provide a title and at least one event." });
  }

  const noticeId = generateRandomId(8);
  savePublishedNotice(noticeId, title, text, events);

  res.json({
    id: noticeId,
    url: `/n/${noticeId}`,
  });
});

// API: Get Notice
app.get("/api/notice/:notice_id", (req: Request, res: Response) => {
  const noticeId = Array.isArray(req.params.notice_id) ? req.params.notice_id[0] : req.params.notice_id;
  const notice = getPublishedNotice(noticeId);
  if (!notice) {
    return res.status(404).json({ error: "Notice not found." });
  }
  res.json(notice);
});

// API: Generate QR Code SVG
app.get("/api/qrcode", async (req: Request, res: Response) => {
  const text = (req.query.text as string) || "";
  if (!text) {
    return res.status(400).send("Missing text query param");
  }
  try {
    const svg = await QRCode.toString(text, {
      type: "svg",
      margin: 1,
      color: {
        dark: "#0f172a",
        light: "#ffffff",
      },
    });
    res.setHeader("Content-Type", "image/svg+xml");
    res.send(svg);
  } catch (err: any) {
    res.status(500).send("Failed to generate QR code");
  }
});

// 404 for other routes
app.use((req: Request, res: Response) => {
  res.status(404).render("404.html", { message: "Page not found." });
});

// Parse port and host from env and CLI arguments
let port = parseInt(process.env.PORT || "3000", 10);
let host = process.env.HOST || "0.0.0.0";

const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === "--port" && argv[i + 1]) {
    port = parseInt(argv[i + 1], 10);
  }
  if (argv[i] === "--host" && argv[i + 1]) {
    host = argv[i + 1];
  }
}

app.listen(port, host, () => {
  console.log(`NoticeLens server running on http://${host}:${port}`);
});
