const express = require("express");
const cors = require("cors");
const youtubedl = require("youtube-dl-exec");
const path = require("path");
const ffmpeg = require("ffmpeg-static");
const fs = require("fs");

const app = express();

app.use(
  cors({
    exposedHeaders: ["Content-Length", "Content-Disposition"],
  }),
);
app.use(express.json());

const cleanUrl = (rawUrl) => {
  try {
    const parsedUrl = new URL(rawUrl);
    parsedUrl.searchParams.delete("si");
    return parsedUrl.toString();
  } catch (e) {
    return rawUrl;
  }
};

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
    });

    // --- Format Filtering & Clean-up Logic ---
    const uniqueFormats = new Map();

    output.formats
      .filter((f) => f.ext === "mp4" || f.ext === "m4a")
      .forEach((f) => {
        // Determine clean resolution name (e.g., "1080p" instead of "1080x1919")
        let resLabel = "Audio Only";
        if (f.vcodec !== "none") {
          // Use height for vertical videos, width for horizontal as standard 'p' format
          const pixels = f.height || f.width;
          resLabel = pixels ? `${pixels}p` : f.resolution;
        }

        // Keep only one best format per resolution
        if (!uniqueFormats.has(resLabel)) {
          uniqueFormats.set(resLabel, f);
        } else {
          // If we find a format with exact filesize, replace the old one
          const existing = uniqueFormats.get(resLabel);
          const existingSize = existing.filesize || existing.filesize_approx;
          const newSize = f.filesize || f.filesize_approx;

          if (!existingSize && newSize) {
            uniqueFormats.set(resLabel, f);
          }
        }
      });

    // Map to final array
    const cleanFormats = Array.from(uniqueFormats.values())
      .map((f) => {
        // Check both exact filesize and approximate filesize
        const sizeBytes = f.filesize || f.filesize_approx;
        const sizeString = sizeBytes
          ? (sizeBytes / 1024 / 1024).toFixed(2) + " MB"
          : "Calculated on Download";

        let resLabel = "Audio Only";
        if (f.vcodec !== "none") {
          const pixels = f.height || f.width;
          resLabel = pixels ? `${pixels}p` : f.resolution;
        }

        return {
          format_id: f.format_id,
          resolution: resLabel,
          ext: f.ext,
          filesize: sizeString,
          hasAudio: f.acodec !== "none",
          hasVideo: f.vcodec !== "none",
        };
      })
      .sort((a, b) => {
        // Sort Highest Quality First
        if (a.hasVideo && b.hasVideo)
          return parseInt(b.resolution) - parseInt(a.resolution);
        return b.hasVideo ? 1 : -1;
      });

    const videoInfo = {
      title: output.title || "Social Media Media",
      thumbnail: output.thumbnail || null,
      formats: cleanFormats,
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
