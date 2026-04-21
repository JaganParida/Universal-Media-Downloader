const express = require("express");
const cors = require("cors");
const youtubedl = require("youtube-dl-exec");
const path = require("path"); // File path handle karne ke liye

const app = express();
app.use(cors());
app.use(express.json());

// ==========================================
// Helper Function to Clean URLs
// ==========================================
const cleanUrl = (rawUrl) => {
  try {
    const parsedUrl = new URL(rawUrl);
    parsedUrl.searchParams.delete("si"); // Remove YouTube tracking params
    return parsedUrl.toString();
  } catch (e) {
    return rawUrl; // Return original if parsing fails
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
      // Yahan humne exact file ka naam daal diya hai
      cookies: path.join(__dirname, "www.youtube.com_cookies.txt"),
    });

    const videoInfo = {
      title: output.title,
      thumbnail: output.thumbnail,
      duration: output.duration_string,
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
    console.error("yt-dlp error:", error.message);
    res.status(500).json({
      error: "Failed to fetch video. Check backend console for details.",
    });
  }
});

// ==========================================
// 2. Stream the Download to the User
// ==========================================
app.get("/api/download", async (req, res) => {
  const { url, format_id, title } = req.query;

  if (!url || !format_id) {
    return res.status(400).send("Missing URL or Format ID");
  }

  const safeTitle = (title || "download").replace(/[^\w\s-]/gi, "");
  res.header("Content-Disposition", `attachment; filename="${safeTitle}.mp4"`);

  try {
    const targetUrl = cleanUrl(url);

    const subprocess = youtubedl.exec(targetUrl, {
      format: format_id,
      output: "-",
      noCheckCertificates: true,
      noWarnings: true,
      // Yahan bhi cookies set kar di hain
      cookies: path.join(__dirname, "www.youtube.com_cookies.txt"),
    });

    subprocess.stdout.pipe(res);

    subprocess.stderr.on("data", (data) => {
      console.log(`yt-dlp log: ${data}`);
    });
  } catch (error) {
    console.error("Download streaming error:", error);
    if (!res.headersSent) {
      res.status(500).send("Failed to stream download.");
    }
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () =>
  console.log(`🚀 API Server running on http://localhost:${PORT}`),
);
