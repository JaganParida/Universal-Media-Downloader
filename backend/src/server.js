//server.js
const express = require("express");
const cors = require("cors");
const https = require("https");
const http = require("http");
const mediaRoutes = require("./routes/mediaRoutes");

const app = express();
const PORT = process.env.PORT || 5000;

// ─── CORS + Security Headers (FIRST — before all routes) ─────────────────────
app.use((req, res, next) => {
  const origin = req.headers.origin;

  // Allow all origins (you can restrict later via ALLOWED_ORIGINS env var)
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

  // These three are CRITICAL — they lift browser same-origin blocking
  // for images, fonts, and media loaded cross-origin
  res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
  res.setHeader("Cross-Origin-Opener-Policy", "unsafe-none");
  res.setHeader("Cross-Origin-Embedder-Policy", "unsafe-none");

  // Handle preflight immediately
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }
  next();
});

// ─── Body Parsing ─────────────────────────────────────────────────────────────
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// ─── Thumbnail Proxy ──────────────────────────────────────────────────────────
// Proxies remote thumbnail images through your server so the browser
// never sees a cross-origin image block (fixes ERR_BLOCKED_BY_RESPONSE)
app.get("/api/thumbnail", (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: "Missing url param" });

  let targetUrl;
  try {
    targetUrl = new URL(decodeURIComponent(url));
  } catch {
    return res.status(400).json({ error: "Invalid URL" });
  }

  // Only proxy known safe image hosts
  const allowedHosts = [
    "scontent.cdninstagram.com",
    "scontent-", // Instagram CDN prefix
    "i.ytimg.com", // YouTube thumbnails
    "img.youtube.com",
    "lookaside.fbsbx.com", // Facebook
    "external.xx.fbcdn.net",
    "video.xx.fbcdn.net",
    "scontent.xx.fbcdn.net",
  ];

  const hostOk = allowedHosts.some(
    (h) => targetUrl.hostname === h || targetUrl.hostname.startsWith(h),
  );
  if (!hostOk) {
    return res.status(403).json({ error: "Host not allowed for proxy" });
  }

  const transport = targetUrl.protocol === "https:" ? https : http;
  const proxyReq = transport.get(
    targetUrl.toString(),
    {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36",
        Accept: "image/webp,image/apng,image/*,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        Referer: "https://www.instagram.com/",
      },
    },
    (proxyRes) => {
      if (proxyRes.statusCode !== 200) {
        return res.status(proxyRes.statusCode).end();
      }
      res.setHeader(
        "Content-Type",
        proxyRes.headers["content-type"] || "image/jpeg",
      );
      res.setHeader("Cache-Control", "public, max-age=86400");
      res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
      proxyRes.pipe(res);
    },
  );

  proxyReq.on("error", (err) => {
    console.error("Thumbnail proxy error:", err.message);
    if (!res.headersSent) res.status(500).end();
  });

  proxyReq.setTimeout(10000, () => {
    proxyReq.destroy();
    if (!res.headersSent) res.status(504).end();
  });
});

// ─── API Routes ───────────────────────────────────────────────────────────────
app.use("/api", mediaRoutes);

// ─── Health Check ─────────────────────────────────────────────────────────────
app.get("/", (_req, res) => {
  res.json({
    status: "ok",
    message: "MediaPro API is running",
    version: "2.1.0",
    endpoints: {
      info: "POST /api/info",
      download: "GET /api/download",
      audioInfo: "POST /api/audio/info",
      audioDownload: "GET /api/audio/download",
      songSearch: "GET /api/audio/search",
      thumbnailProxy: "GET /api/thumbnail?url=<encoded-url>",
    },
  });
});

// ─── 404 Handler ──────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: `Route ${req.path} not found` });
});

// ─── Global Error Handler ─────────────────────────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error("💥 Unhandled error:", err.message);
  if (!res.headersSent) {
    res.status(500).json({ error: err.message || "Internal server error" });
  }
});

app.listen(PORT, () => {
  console.log(`\n🚀 MediaPro API running on port ${PORT}`);
});

module.exports = app;
