const express = require("express");
const cors = require("cors");
const youtubedl = require("yt-dlp-exec");
const fs = require("fs");
const path = require("path");
const os = require("os");
const { execSync } = require("child_process");

const app = express();
app.use(cors());
app.use(express.json());

/**
 * 1. Fetch Metadata (Thumbnail, Title, Formats)
 */
app.post("/api/info", async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: "URL is required" });

  try {
    const output = await youtubedl(url, {
      dumpSingleJson: true,
      noCheckCertificates: true,
      noWarnings: true,
      addHeader: ["referer:youtube.com"],
    });

    const videoInfo = {
      title: output.title,
      thumbnail: output.thumbnail,
      duration: output.duration_string,
      formats: output.formats
        .filter((f) => f.vcodec !== "none") // only video formats
        .map((f) => ({
          format_id: f.format_id,
          resolution: f.resolution || f.format_note || "HD",
          ext: f.ext || "mp4",
          filesize: f.filesize
            ? (f.filesize / (1024 * 1024)).toFixed(2) + " MB"
            : "Calculating...",
          hasAudio: f.acodec !== "none" && f.acodec !== undefined,
          hasVideo: f.vcodec !== "none", // required for frontend
        }))
        .reverse(), // high quality first
    };

    res.json(videoInfo);
  } catch (error) {
    console.error("Info Error:", error.message);
    res.status(500).json({ error: "Could not fetch video details." });
  }
});

/**
 * 2. Download Route (Auto Audio Merge + Safe)
 */
app.get("/api/download", async (req, res) => {
  const { url, format_id, title } = req.query;

  if (!url || !format_id) {
    return res.status(400).send("Invalid Request");
  }

  const safeTitle = (title || "video").replace(/[^\w\s-]/gi, "");
  const tempFilePath = path.join(os.tmpdir(), `dl-${Date.now()}.mp4`);

  try {
    console.log(`Downloading: ${safeTitle}`);

    // ✅ Ensure FFmpeg exists
    try {
      execSync("ffmpeg -version", { stdio: "ignore" });
    } catch {
      return res.status(500).send("FFmpeg not installed on server");
    }

    // ✅ Always safe: merge video + best audio
    const formatConfig = `${format_id}+bestaudio/best`;

    await youtubedl(url, {
      format: formatConfig,
      output: tempFilePath,
      mergeOutputFormat: "mp4",
      noCheckCertificates: true,
    });

    // ✅ Send file
    res.download(tempFilePath, `${safeTitle}.mp4`, (err) => {
      if (err) console.error("Send error:", err);

      // ✅ Cleanup safely
      fs.unlink(tempFilePath, () => {});
    });
  } catch (error) {
    console.error("Download Error:", error.message);

    fs.unlink(tempFilePath, () => {});

    if (!res.headersSent) {
      res.status(500).send("Download failed. Check FFmpeg installation.");
    }
  }
});

const PORT = 5000;
app.listen(PORT, () =>
  console.log(`🚀 Backend running at http://localhost:${PORT}`),
);
