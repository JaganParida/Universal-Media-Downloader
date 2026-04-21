const express = require("express");
const cors = require("cors");
const youtubedl = require("youtube-dl-exec");
const path = require("path");
const ffmpeg = require("ffmpeg-static");
const fs = require("fs");

const app = express();
app.use(cors());
app.use(express.json());

// ==========================================
// Helper Function to Clean URLs
// ==========================================
const cleanUrl = (rawUrl) => {
  try {
    const parsedUrl = new URL(rawUrl);
    parsedUrl.searchParams.delete("si"); // Remove tracking params
    return parsedUrl.toString();
  } catch (e) {
    return rawUrl;
  }
};

// ==========================================
// 1. Fetch Metadata (Thumbnail, Title, Formats)
// ==========================================
app.post("/api/info", async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: "URL is required" });

  try {
    const targetUrl = cleanUrl(url);

    const output = await youtubedl(targetUrl, {
      dumpSingleJson: true,
      noCheckCertificates: true,
      noWarnings: true,
      preferFreeFormats: true,
      ffmpegLocation: ffmpeg,
      // Cookies line completely removed
    });

    const videoInfo = {
      title: output.title || "Social Media Video",
      thumbnail: output.thumbnail || null,
      duration: output.duration_string || "N/A",
      formats: output.formats
        .filter((f) => f.ext === "mp4" || f.ext === "m4a")
        .map((f) => ({
          format_id: f.format_id,
          resolution: f.resolution || "Audio Only",
          ext: f.ext,
          filesize: f.filesize
            ? (f.filesize / 1024 / 1024).toFixed(2) + " MB"
            : "Unknown Size",
          hasAudio: f.acodec !== "none",
          hasVideo: f.vcodec !== "none",
        }))
        .sort((a, b) => (b.hasAudio && b.hasVideo ? 1 : -1)),
    };

    res.json(videoInfo);
  } catch (error) {
    console.error("Fetch error:", error.message);
    res.status(500).json({
      error:
        "Could not fetch media. Make sure it is a public Instagram or Facebook link.",
    });
  }
});

// ==========================================
// 2. Download & Merge (With Sound & 1080p)
// ==========================================
app.get("/api/download", async (req, res) => {
  const { url, format_id, title } = req.query;

  if (!url || !format_id) {
    return res.status(400).send("Missing URL or Format ID");
  }

  const safeTitle = (title || "media_download").replace(/[^\w\s-]/gi, "");
  const targetUrl = cleanUrl(url);

  const tempFileName = `temp_${Date.now()}.mp4`;
  const tempFilePath = path.join(__dirname, tempFileName);

  try {
    await youtubedl(targetUrl, {
      format: `${format_id}+bestaudio/best`,
      output: tempFilePath,
      noCheckCertificates: true,
      noWarnings: true,
      ffmpegLocation: ffmpeg,
      // Cookies line completely removed
    });

    res.download(tempFilePath, `${safeTitle}.mp4`, (err) => {
      if (fs.existsSync(tempFilePath)) {
        fs.unlinkSync(tempFilePath);
      }
    });
  } catch (error) {
    console.error("Download processing error:", error.message);
    if (fs.existsSync(tempFilePath)) {
      fs.unlinkSync(tempFilePath);
    }
    if (!res.headersSent) {
      res
        .status(500)
        .send("Failed to process the media file. Please try again.");
    }
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () =>
  console.log(`🚀 API Server running on http://localhost:${PORT}`),
);
