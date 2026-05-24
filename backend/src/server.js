const express = require("express");
const cors = require("cors");
const mediaRoutes = require("./routes/mediaRoutes");

const app = express();
const PORT = process.env.PORT || 5000;

const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",").map((o) => o.trim())
  : ["*"];

// ─── Preflight + CORS headers (must be FIRST, before any route) ───────────────
app.use((req, res, next) => {
  const origin = req.headers.origin;
  res.setHeader("Access-Control-Allow-Origin", origin || "*");
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, DELETE, OPTIONS",
  );
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, X-Requested-With, Accept, Origin",
  );
  res.setHeader(
    "Access-Control-Expose-Headers",
    "Content-Length, Content-Disposition, Content-Type",
  );
  res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
  res.setHeader("Cross-Origin-Opener-Policy", "unsafe-none");
  res.setHeader("Cross-Origin-Embedder-Policy", "unsafe-none");

  // Handle preflight immediately — never touches Express router
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }
  next();
});

// ─── Body Parsing ─────────────────────────────────────────────────────────────
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use("/api", mediaRoutes);

// ─── Health Check ─────────────────────────────────────────────────────────────
app.get("/", (req, res) => {
  res.json({
    status: "ok",
    message: "MediaPro API is running",
    version: "2.0.0",
    endpoints: {
      info: "POST /api/info",
      download: "GET /api/download",
      audioInfo: "POST /api/audio/info",
      audioDownload: "GET /api/audio/download",
      songSearch: "GET /api/audio/search",
    },
  });
});

// ─── 404 Handler ─────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: `Route ${req.path} not found` });
});

// ─── Global Error Handler ─────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error("💥 Unhandled error:", err.message);
  if (!res.headersSent) {
    res.status(500).json({ error: err.message || "Internal server error" });
  }
});

app.listen(PORT, () => {
  console.log(`\n🚀 MediaPro API running on port ${PORT}`);
  console.log(`   CORS: ${allowedOrigins.join(", ")}`);
});

module.exports = app;
