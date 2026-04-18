const express = require("express");
const cors = require("cors");
const youtubedl = require("youtube-dl-exec");

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
    // Clean the URL before processing
    const targetUrl = cleanUrl(url);

    const output = await youtubedl(targetUrl, {
      dumpSingleJson: true,
      noCheckCertificates: true,
      noWarnings: true,
      preferFreeFormats: true,
      forceIpv4: true,
    });

    const videoInfo = {
      title: output.title,
      thumbnail: output.thumbnail,
      duration: output.duration_string,
      // Filter out junk formats and only keep useful video/audio streams
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
        // Prioritize formats that have BOTH video and audio built-in
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

  // Clean the title so it's safe for a filename
  const safeTitle = (title || "download").replace(/[^\w\s-]/gi, "");

  // Force the browser to download the file instead of playing it
  res.header("Content-Disposition", `attachment; filename="${safeTitle}.mp4"`);

  try {
    // Clean the URL here as well to ensure the download doesn't fail
    const targetUrl = cleanUrl(url);

    // Execute yt-dlp and pipe the output DIRECTLY to the response
    // This prevents the server from running out of disk space or RAM!
    const subprocess = youtubedl.exec(targetUrl, {
      format: format_id,
      output: "-", // Tells yt-dlp to output to standard output
      noCheckCertificates: true,
      noWarnings: true,
      forceIpv4: true,
      cookiesFromBrowser: "opera",
    });

    // Pipe the download stream directly to the user's browser
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
