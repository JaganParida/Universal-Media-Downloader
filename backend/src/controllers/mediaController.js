// File: src/controllers/mediaController.js
//
// Robust media downloader — YouTube · Facebook · Instagram · Generic

const youtubedl = require("youtube-dl-exec");
const path = require("path");
const ffmpegBin = require("ffmpeg-static");
const fs = require("fs");
const os = require("os");
const { cleanUrl } = require("../utils/helpers");

// ─── Platform Detection ───────────────────────────────────────────────────────

const detectPlatform = (url) => {
  if (/instagram\.com/i.test(url)) return "instagram";
  if (/facebook\.com|fb\.watch|fb\.com/i.test(url)) return "facebook";
  if (/youtube\.com|youtu\.be/i.test(url)) return "youtube";
  if (/twitter\.com|x\.com/i.test(url)) return "twitter";
  if (/tiktok\.com/i.test(url)) return "tiktok";
  return "generic";
};

const normalizeYouTubeUrl = (url) => {
  try {
    const u = new URL(url);
    const shortsMatch = u.pathname.match(/^\/shorts\/([a-zA-Z0-9_-]+)/);
    if (shortsMatch) {
      return `https://www.youtube.com/watch?v=${shortsMatch[1]}`;
    }
  } catch (_) {}
  return url;
};

// ─── BASE OPTIONS (No Custom FB/IG Headers to prevent blocking) ───

const BASE = {
  ffmpegLocation: ffmpegBin,
  noCheckCertificates: true,
  noWarnings: true, // ✅ FIXED: Wapas true kar diya taki --no-no-warnings wala crash na aaye
  retries: 10,
  fragmentRetries: 10,
  socketTimeout: 60,
  noPlaylist: true,
  bufferSize: "16K",
  concurrentFragments: 4,
};

const PLATFORM_OPTIONS = {
  youtube: {
    ...BASE,
    extractorArgs: "youtube:player_client=web",
    geoBypass: true,
  },
  facebook: {
    ...BASE,
    geoBypass: true,
  },
  instagram: {
    ...BASE,
    geoBypass: true,
  },
  generic: {
    ...BASE,
    geoBypass: true,
  },
};

const getPlatformOptions = (platform) =>
  PLATFORM_OPTIONS[platform] ?? PLATFORM_OPTIONS.generic;

// ─── Resolution Bucketing ───

const bucketResolution = (width, height) => {
  const short = Math.min(width || 0, height || 0);
  const long = Math.max(width || 0, height || 0);
  const ref = short > 0 ? short : long;
  if (ref >= 2160) return { cleanRes: "4K", sortValue: 2160 };
  if (ref >= 1440) return { cleanRes: "1440p", sortValue: 1440 };
  if (ref >= 1080) return { cleanRes: "1080p", sortValue: 1080 };
  if (ref >= 720) return { cleanRes: "720p", sortValue: 720 };
  if (ref >= 480) return { cleanRes: "480p", sortValue: 480 };
  if (ref >= 360) return { cleanRes: "360p", sortValue: 360 };
  if (ref >= 240) return { cleanRes: "240p", sortValue: 240 };
  if (ref > 0) return { cleanRes: "144p", sortValue: 144 };
  return { cleanRes: "Video", sortValue: 100 };
};

const estimateSize = (f, durationSec) => {
  const toMB = (bytes) => `${(bytes / 1_048_576).toFixed(1)} MB`;
  if (f.filesize)
    return { sizeString: toMB(f.filesize), sizeValueForSort: f.filesize };
  if (f.filesize_approx)
    return {
      sizeString: `~${toMB(f.filesize_approx)}`,
      sizeValueForSort: f.filesize_approx,
    };
  if (f.tbr && durationSec) {
    const est = (f.tbr * 1000 * durationSec) / 8;
    return { sizeString: `~${toMB(est)}`, sizeValueForSort: est };
  }
  return { sizeString: "", sizeValueForSort: 0 };
};

const friendlyError = (rawMessage = "") => {
  const m = rawMessage.toLowerCase();
  if (m.includes("sign in") || m.includes("login") || m.includes("age"))
    return "This video requires login.";
  if (m.includes("private"))
    return "This content is private and cannot be downloaded.";
  if (m.includes("not found") || m.includes("404")) return "Content not found.";
  if (m.includes("rate") || m.includes("429"))
    return "Too many requests. Please wait a moment.";
  return "Could not fetch media. Make sure it is a valid, public video link.";
};

const withRetry = async (fn, maxAttempts = 3, delay = 2000) => {
  let lastError;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      console.log(
        `🔄 [RETRY LOG] Execution attempt ${attempt} of ${maxAttempts}...`,
      );
      return await fn();
    } catch (err) {
      lastError = err;
      console.error(`⚠️ [RETRY LOG] Attempt ${attempt} failed:`, err.message);
      const msg = (err.message || "").toLowerCase();
      const isTransient =
        msg.includes("network") ||
        msg.includes("timeout") ||
        msg.includes("connection") ||
        msg.includes("429");
      if (!isTransient || attempt === maxAttempts) throw err;
      await new Promise((r) => setTimeout(r, delay * attempt));
    }
  }
  throw lastError;
};

// ─── TEMP FILE FINDER ───
const findTempFile = (basePath) => {
  if (fs.existsSync(basePath)) return basePath;
  const dir = path.dirname(basePath);
  const base = path.basename(basePath, path.extname(basePath));
  try {
    const files = fs.readdirSync(dir).filter((f) => f.startsWith(base));
    console.log(
      "🕵️ [TEMP FILE LOG] Files found in temp dir matching base:",
      files,
    );
    const finalFile = files.find((f) => {
      if (f.endsWith(".part") || f.endsWith(".ytdl")) return false;
      if (f.includes(".f") && /\d/.test(f)) return false;
      return true;
    });
    if (finalFile) {
      console.log(
        "✅ [TEMP FILE LOG] Final merged file identified:",
        finalFile,
      );
      return path.join(dir, finalFile);
    }
  } catch (err) {
    console.error("❌ [TEMP FILE LOG] Error reading temp directory:", err);
  }
  return null;
};

// ─── getMediaInfo ─────────────────────────────────────────────────────────────

const getMediaInfo = async (req, res) => {
  const { url } = req.body;
  console.log("\n==========================================");
  console.log("ℹ️ [INFO API] Request received for URL:", url);

  if (!url) return res.status(400).json({ error: "URL is required" });

  try {
    let targetUrl = cleanUrl(url);
    const platform = detectPlatform(targetUrl);
    console.log("ℹ️ [INFO API] Detected Platform:", platform);

    if (platform === "youtube") {
      targetUrl = normalizeYouTubeUrl(targetUrl);
    }

    const options = getPlatformOptions(platform);
    console.log("ℹ️ [INFO API] Fetching metadata via yt-dlp...");

    const output = await withRetry(() =>
      youtubedl(targetUrl, { ...options, dumpSingleJson: true }),
    );

    const durationSec = output.duration || 0;
    const formats = Array.isArray(output.formats) ? output.formats : [];

    const formatsWithAudio = formats.filter(
      (f) => f.acodec && f.acodec !== "none",
    ).length;
    console.log(
      `ℹ️ [INFO API] Total Formats: ${formats.length} | Formats with Audio track: ${formatsWithAudio}`,
    );

    const VALID_EXTS = new Set(["mp4", "m4a", "webm", "mkv"]);
    const uniqueFormats = new Map();

    formats
      .filter((f) => {
        const hasV = f.vcodec && f.vcodec !== "none";
        const hasA = f.acodec && f.acodec !== "none";
        return VALID_EXTS.has((f.ext || "").toLowerCase()) || hasV || hasA;
      })
      .forEach((f) => {
        const hasVideo = f.vcodec && f.vcodec !== "none";
        let cleanRes = "Audio";
        let sortValue = 0;

        if (hasVideo) {
          let w = f.width || 0;
          let h = f.height || 0;
          if (!w && !h && f.resolution && f.resolution.includes("x")) {
            const [pw, ph] = f.resolution.split("x").map(Number);
            w = pw || 0;
            h = ph || 0;
          }
          if (!w && h) w = h;
          if (!h && w) h = w;

          const bucketed = bucketResolution(w, h);
          cleanRes = bucketed.cleanRes;
          sortValue = bucketed.sortValue;
        }

        const { sizeString, sizeValueForSort } = estimateSize(f, durationSec);
        const key = hasVideo ? cleanRes : `Audio_${f.format_id}`;

        if (
          !uniqueFormats.has(key) ||
          sizeValueForSort > (uniqueFormats.get(key).sizeValueForSort || 0)
        ) {
          uniqueFormats.set(key, {
            ...f,
            cleanRes,
            sortValue,
            sizeString,
            sizeValueForSort,
          });
        }
      });

    if (uniqueFormats.size === 0) {
      uniqueFormats.set("Best", {
        format_id: "b",
        cleanRes: "Best",
        sortValue: 9999,
        ext: "mp4",
        sizeString: "",
        sizeValueForSort: 0,
        acodec: "aac",
        vcodec: "h264",
      });
    }

    const cleanFormats = Array.from(uniqueFormats.values())
      .map((f) => ({
        format_id: f.format_id,
        resolution: f.cleanRes,
        sortValue: f.sortValue,
        ext: f.ext,
        filesize: f.sizeString,
        hasAudio: !!(f.acodec && f.acodec !== "none"),
        hasVideo: !!(f.vcodec && f.vcodec !== "none"),
      }))
      .sort((a, b) =>
        a.hasVideo && b.hasVideo
          ? b.sortValue - a.sortValue
          : a.hasVideo
            ? -1
            : b.hasVideo
              ? 1
              : 0,
      );

    console.log(
      "✅ [INFO API] Successfully parsed formats. Returning to client.",
    );
    return res.json({
      title: output.title || "Video",
      description: output.description || "",
      thumbnail: output.thumbnail || null,
      duration: durationSec,
      platform,
      formats: cleanFormats,
    });
  } catch (error) {
    console.error("❌ [INFO API] Error:", error.message);
    return res.status(500).json({ error: friendlyError(error.message) });
  }
};

// ─── downloadMedia ────────────────────────────────────────────────────────────

const downloadMedia = async (req, res) => {
  const { url, format_id, title } = req.query;

  console.log("\n==========================================");
  console.log("🚀 [DOWNLOAD API] INITIALIZING DOWNLOAD...");
  console.log("➡️ URL:", url);
  console.log("➡️ Requested format_id:", format_id);
  console.log("➡️ Title:", title);

  if (!url) {
    console.error("❌ [DOWNLOAD API] Missing URL");
    return res.status(400).send("Missing URL");
  }

  const safeTitle =
    (title || "download").replace(/[^\w\s\-]/gi, "").trim() || "download";
  let targetUrl = cleanUrl(url);
  const platform = detectPlatform(targetUrl);

  console.log("🔍 [DOWNLOAD API] Platform detected:", platform);

  if (platform === "youtube") {
    targetUrl = normalizeYouTubeUrl(targetUrl);
  }

  const options = getPlatformOptions(platform);

  console.log("⚙️ [DOWNLOAD API] FFmpeg Path config:", options.ffmpegLocation);
  if (!fs.existsSync(options.ffmpegLocation)) {
    console.error(
      "🚨🚨🚨 [CRITICAL ERROR] FFmpeg binary NOT FOUND at:",
      options.ffmpegLocation,
    );
    console.error(
      "🚨 If FFmpeg is missing, yt-dlp CANNOT merge audio and video!",
    );
  } else {
    console.log("✅ [DOWNLOAD API] FFmpeg binary found successfully.");
  }

  // Yahi format string pehle Facebook ka audio issue theek karegi
  let formatStr = "bv*+ba/b";

  if (format_id && format_id !== "best" && format_id !== "undefined") {
    formatStr = `${format_id}+ba/${format_id}/bv*+ba/b`;
  }

  console.log(
    "🎯 [DOWNLOAD API] Final Format String passed to yt-dlp:",
    formatStr,
  );

  const tempBase = `udl_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const tempFilePath = path.join(os.tmpdir(), `${tempBase}.mp4`);

  console.log("📁 [DOWNLOAD API] Target Temp Output File:", tempFilePath);

  const cleanup = () => {
    try {
      const dir = path.dirname(tempFilePath);
      const base = path.basename(tempFilePath, path.extname(tempFilePath));
      fs.readdirSync(dir)
        .filter((f) => f.startsWith(base))
        .forEach((f) => {
          try {
            fs.unlinkSync(path.join(dir, f));
            console.log("🧹 [CLEANUP] Deleted temp file:", f);
          } catch (_) {}
        });
    } catch (e) {
      console.error("❌ [CLEANUP] Error during cleanup:", e);
    }
  };

  try {
    console.log(`⏳ [DOWNLOAD API] Calling yt-dlp to download and merge...`);

    const ytdlpOptions = {
      ...options,
      format: formatStr,
      output: tempFilePath,
      mergeOutputFormat: "mp4",
      verbose: true,
    };

    console.log("🛠️ [DOWNLOAD API] yt-dlp Options:", ytdlpOptions);

    await withRetry(() => youtubedl(targetUrl, ytdlpOptions));

    console.log(
      "✅ [DOWNLOAD API] yt-dlp execution completed without throwing error.",
    );

    const actualFile = findTempFile(tempFilePath);
    if (!actualFile) {
      console.error(
        "🚨 [DOWNLOAD API] actualFile is null! yt-dlp failed to create the file.",
      );
      throw new Error("Output file was not created by yt-dlp.");
    }

    const stat = fs.statSync(actualFile);
    console.log(
      `📊 [DOWNLOAD API] File created successfully. Size: ${(stat.size / 1_048_576).toFixed(2)} MB`,
    );

    if (stat.size === 0) {
      console.error("🚨 [DOWNLOAD API] File size is 0 bytes!");
      cleanup();
      throw new Error(
        "Downloaded file is empty. The video may be unavailable.",
      );
    }

    const ext = path.extname(actualFile).slice(1) || "mp4";
    const mimeTypes = {
      mp4: "video/mp4",
      mkv: "video/x-matroska",
      webm: "video/webm",
      m4a: "audio/mp4",
      mp3: "audio/mpeg",
    };

    console.log("🚀 [DOWNLOAD API] Piping file to client response stream...");

    res.setHeader("Content-Type", mimeTypes[ext] || "video/mp4");
    res.setHeader("Content-Length", stat.size);
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${safeTitle}.${ext}"`,
    );

    const stream = fs.createReadStream(actualFile);
    stream.pipe(res);

    stream.on("error", (err) => {
      console.error("❌ [STREAM ERROR] Stream failed:", err);
      cleanup();
    });
    res.on("finish", () => {
      console.log(
        "✅ [DOWNLOAD API] Download finished successfully. Cleaning up...",
      );
      cleanup();
    });
    res.on("close", () => cleanup());
  } catch (error) {
    console.error("\n🚨🚨🚨 [FATAL DOWNLOAD ERROR] 🚨🚨🚨");
    console.error("Message:", error.message);
    console.error("Stack Trace:", error.stack);
    cleanup();
    if (!res.headersSent) {
      res.status(500).send(friendlyError(error.message));
    }
  }
};

module.exports = { getMediaInfo, downloadMedia };
