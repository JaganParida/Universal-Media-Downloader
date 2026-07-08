const express = require("express");
const cors = require("cors");
const mediaRoutes = require("./routes/mediaRoutes"); // Import the routes

const app = express();

// Middleware
app.use(
  cors({
    exposedHeaders: ["Content-Length", "Content-Disposition"],
  }),
);
app.use(express.json());

// Simple In-Memory Rate Limiter (protects against brute-force / spamming)
const rateLimits = new Map();
const rateLimiter = (req, res, next) => {
  const ip = req.ip || req.headers["x-forwarded-for"] || req.socket.remoteAddress;
  const now = Date.now();
  
  if (!rateLimits.has(ip)) {
    rateLimits.set(ip, []);
  }
  
  const windowStart = now - 15 * 60 * 1000; // 15 mins window
  const requests = rateLimits.get(ip).filter(timestamp => timestamp > windowStart);
  
  if (requests.length >= 60) {
    return res.status(429).json({ error: "Too many requests from this IP. Please try again in 15 minutes." });
  }
  
  requests.push(now);
  rateLimits.set(ip, requests);
  next();
};

// Main API Route Setup (with rate limiting)
app.use("/api", rateLimiter, mediaRoutes);

// Root route check (Optional - for Vercel/Render health check)
app.get("/", (req, res) => {
  res.send("API Server is running perfectly.");
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () =>
  console.log(`🚀 API Server running on http://localhost:${PORT}`),
);
