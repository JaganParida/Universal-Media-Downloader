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

// Main API Route Setup
app.use("/api", mediaRoutes);

// Root route check (Optional - for Vercel/Render health check)
app.get("/", (req, res) => {
  res.send("API Server is running perfectly.");
});

// Start Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () =>
  console.log(`🚀 API Server running on http://localhost:${PORT}`),
);
