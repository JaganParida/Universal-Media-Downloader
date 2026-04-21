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
    const durationSec = output.duration || 0;

    output.formats
      .filter((f) => f.ext === "mp4" || f.ext === "m4a")
      .forEach((f) => {
        let cleanRes = "Audio";
        let sortValue = 0;

        if (f.vcodec !== "none") {
          let w = f.width || 0;
          let h = f.height || 0;

          if (!w && !h && f.resolution && f.resolution.includes("x")) {
            const parts = f.resolution.split("x").map(Number);
            w = parts[0];
            h = parts[1];
          }

          if (!w && h) w = h;
          if (!h && w) h = w;

          let shortEdge = Math.min(w, h);

          // Strict Standard Resolution Bucketing
          if (shortEdge >= 1000) {
            cleanRes = "1080p";
            sortValue = 1080;
          } else if (shortEdge >= 700) {
            cleanRes = "720p";
            sortValue = 720;
          } else if (shortEdge >= 480) {
            cleanRes = "480p";
            sortValue = 480;
          } else if (shortEdge >= 360) {
            cleanRes = "360p";
            sortValue = 360;
          } else if (shortEdge >= 240) {
            cleanRes = "240p";
            sortValue = 240;
          } else if (shortEdge > 0) {
            cleanRes = "144p";
            sortValue = 144;
          } else {
            cleanRes = "Video";
            sortValue = 100;
          }
        }

        let sizeString = "";
        let sizeValueForSort = 0;

        if (f.filesize) {
          sizeString = `${(f.filesize / 1048576).toFixed(1)} MB`;
          sizeValueForSort = f.filesize;
        } else if (f.filesize_approx) {
          sizeString = `~${(f.filesize_approx / 1048576).toFixed(1)} MB`;
          sizeValueForSort = f.filesize_approx;
        } else if (f.tbr && durationSec) {
          const estBytes = (f.tbr * 1000 * durationSec) / 8;
          sizeString = `~${(estBytes / 1048576).toFixed(1)} MB`;
          sizeValueForSort = estBytes;
        }

        const key = cleanRes;

        if (!uniqueFormats.has(key)) {
          uniqueFormats.set(key, {
            ...f,
            cleanRes,
            sortValue,
            sizeString,
            sizeValueForSort,
          });
        } else {
          if (sizeValueForSort > uniqueFormats.get(key).sizeValueForSort) {
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
        if (a.hasVideo && b.hasVideo) return b.sortValue - a.sortValue;
        return b.hasVideo ? 1 : -1;
      });

    // ADDED DESCRIPTION HERE
    const videoInfo = {
      title: output.title || "Social Media Video",
      description: output.description || "",
      thumbnail: output.thumbnail || null,
      formats: cleanFormats,
    };

    res.json(videoInfo);
  } catch (error) {
    console.error("Fetch error:", error.message);
    res
      .status(500)
      .json({ error: "Could not fetch media. Make sure it is a public link." });
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
      if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
    });
  } catch (error) {
    console.error("Download error:", error.message);
    if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
    if (!res.headersSent) res.status(500).send("Failed to process.");
  }
};

module.exports = { getMediaInfo, downloadMedia };
