// File: src/controllers/mediaController.js

const youtubedl = require("youtube-dl-exec");
const path = require("path");
const ffmpeg = require("ffmpeg-static");
const fs = require("fs");
const { cleanUrl } = require("../utils/helpers");

const getMediaInfo = async (req, res) => {
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

    const uniqueFormats = new Map();
    const durationSec = output.duration; // Extract duration in seconds for calculation

    output.formats
      .filter((f) => f.ext === "mp4" || f.ext === "m4a")
      .forEach((f) => {
        let cleanRes = "Audio";
        let sortValue = 0;

        // 1. Resolution Cleaning Logic
        if (f.vcodec !== "none") {
          const resString = f.resolution || "";
          let height = f.height;

          if (!height && resString.includes("x")) {
            const parts = resString.split("x").map(Number);
            height = Math.min(...parts); // Best fit for vertical videos
          }

          if (height && !isNaN(height)) {
            cleanRes = `${height}p`;
            sortValue = height;
          } else {
            cleanRes = "HQ Video";
            sortValue = 999;
          }
        }

        // 2. The Ultimate "Approximate Size" Calculator Logic
        let sizeString = "";
        let sizeValueForSort = 0; // To help pick the best format later

        if (f.filesize) {
          // Exact size available
          sizeString = `${(f.filesize / 1048576).toFixed(1)} MB`;
          sizeValueForSort = f.filesize;
        } else if (f.filesize_approx) {
          // Platform gave approximate size
          sizeString = `~ ${(f.filesize_approx / 1048576).toFixed(1)} MB`;
          sizeValueForSort = f.filesize_approx;
        } else if (f.tbr && durationSec) {
          // MATHEMATICAL HACK: Size = (Total Bitrate in kbps * 1000 * duration in sec) / 8
          const estBytes = (f.tbr * 1000 * durationSec) / 8;
          sizeString = `~ ${(estBytes / 1048576).toFixed(1)} MB`;
          sizeValueForSort = estBytes;
        } else {
          // Fallback for UI if absolutely nothing works
          sizeString = "Approx Size";
          sizeValueForSort = 0;
        }

        const key = cleanRes + (f.vcodec === "none" ? "_audio" : "_video");

        // 3. Keep only the best format for each resolution
        if (!uniqueFormats.has(key)) {
          uniqueFormats.set(key, {
            ...f,
            cleanRes,
            sortValue,
            sizeString,
            sizeValueForSort,
          });
        } else {
          // If we found a format with better size data, replace the old one
          if (!uniqueFormats.get(key).sizeValueForSort && sizeValueForSort) {
            uniqueFormats.set(key, {
              ...f,
              cleanRes,
              sortValue,
              sizeString,
              sizeValueForSort,
            });
          }
        }
      });

    const cleanFormats = Array.from(uniqueFormats.values())
      .map((f) => ({
        format_id: f.format_id,
        resolution: f.cleanRes,
        sortValue: f.sortValue,
        ext: f.ext,
        filesize: f.sizeString,
        hasAudio: f.acodec !== "none",
        hasVideo: f.vcodec !== "none",
      }))
      .sort((a, b) => {
        if (a.hasVideo && b.hasVideo) return b.sortValue - a.sortValue; // Highest res first
        return b.hasVideo ? 1 : -1; // Videos before audio
      });

    const videoInfo = {
      title: output.title || "Social Media Video",
      thumbnail: output.thumbnail || null,
      formats: cleanFormats,
    };

    res.json(videoInfo);
  } catch (error) {
    console.error("Fetch error:", error.message);
    res.status(500).json({
      error: "Could not fetch media. Make sure it is a public link.",
    });
  }
};

const downloadMedia = async (req, res) => {
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
      res.status(500).send("Failed to process the media file.");
    }
  }
};

module.exports = { getMediaInfo, downloadMedia };
