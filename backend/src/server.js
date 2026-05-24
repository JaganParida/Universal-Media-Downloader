const express = require("express");
const cors = require("cors");
const mediaRoutes = require("./routes/mediaRoutes");

const app = express();
const PORT = process.env.PORT || 5000;

const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",").map((o) => o.trim())
  : ["*"];

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes("*")) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error("Not allowed by CORS"));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "X-Requested-With",
    "Accept",
    "Origin",
  ],
  exposedHeaders: ["Content-Length", "Content-Disposition", "Content-Type"],
  optionsSuccessStatus: 200,
};

app.use(cors(corsOptions));

// ✅ FIXED: was "/(.*)" which breaks on Node.js v24 / new path-to-regexp
app.options("/*", cors(corsOptions));

app.use((req, res, next) => {
  res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
  res.setHeader("Cross-Origin-Opener-Policy", "unsafe-none");
  res.setHeader("Cross-Origin-Embedder-Policy", "unsafe-none");
  const origin = req.headers.origin;
  if (origin) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  } else {
    res.setHeader("Access-Control-Allow-Origin", "*");
  }
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader(
    "Access-Control-Expose-Headers",
    "Content-Length, Content-Disposition, Content-Type",
  );
  next();
});

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

app.use("/api", mediaRoutes);

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

app.use((req, res) => {
  res.status(404).json({ error: `Route ${req.path} not found` });
});

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
