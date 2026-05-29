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

// ─── URL Normalizers ──────────────────────────────────────────────────────────

const normalizeYouTubeUrl = (url) => {
  try {
    const u = new URL(url);
    const shortsMatch = u.pathname.match(/^\/shorts\/([a-zA-Z0-9_-]+)/);
    if (shortsMatch) {
      return `https://www.youtube.com/watch?v=${shortsMatch[1]}`;
    }
    // Keep only v= param for clean URL
    const videoId = u.searchParams.get("v");
    if (videoId && u.hostname.includes("youtube.com")) {
      return `https://www.youtube.com/watch?v=${videoId}`;
    }
    // youtu.be short link
    if (u.hostname === "youtu.be") {
      const id = u.pathname.slice(1).split("/")[0];
      if (id) return `https://www.youtube.com/watch?v=${id}`;
    }
  } catch (_) {}
  return url;
};

const normalizeInstagramUrl = (url) => {
  try {
    const u = new URL(url);
    u.search = ""; // Strip tracking params (?igsh=, ?utm_, etc.)
    u.hash = "";
    // Make sure path ends correctly
    let pathname = u.pathname;
    if (!pathname.endsWith("/")) pathname += "/";
    return `${u.protocol}//${u.hostname}${pathname}`;
  } catch (_) {}
  return url;
};

const normalizeFacebookUrl = (url) => {
  return url
    .replace(/m\.facebook\.com/i, "www.facebook.com")
    .replace(/web\.facebook\.com/i, "www.facebook.com");
};

// ─── User Agents ──────────────────────────────────────────────────────────────

const UA_DESKTOP =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36";
const UA_INSTAGRAM_MOBILE =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1";

// ─── BASE OPTIONS (ZERO COOKIES) ──────────────────────────────────────────────

const BASE = {
  ffmpegLocation: ffmpegBin,
  noCheckCertificates: true,
  noWarnings: true,
  retries: 10,
  fragmentRetries: 10,
  socketTimeout: 60,
  noPlaylist: true,
  bufferSize: "16K",
  preferFreeFormats: true,
};

const PLATFORM_OPTIONS = {
  youtube: {
    ...BASE,
    // CRITICAL FIX: use android + web clients → bypasses most bot checks WITHOUT cookies
    extractorArgs: "youtube:player_client=android,web;player_skip=configs",
    geoBypass: true,
    addHeader: [`user-agent:${UA_DESKTOP}`],
  },
  facebook: {
    ...BASE,
    geoBypass: true,
    addHeader: [`user-agent:${UA_DESKTOP}`, "accept-language:en-US,en;q=0.9"],
  },
  instagram: {
    ...BASE,
    geoBypass: true,
    addHeader: [
      `user-agent:${UA_INSTAGRAM_MOBILE}`,
      "accept-language:en-US,en;q=0.9",
      "x-ig-app-id:936619743392459",
    ],
  },
  generic: {
    ...BASE,
    geoBypass: true,
    addHeader: [`user-agent:${UA_DESKTOP}`],
  },
};

const getPlatformOptions = (platform) =>
  PLATFORM_OPTIONS[platform] ?? PLATFORM_OPTIONS.generic;

// ─── Resolution Bucketing ─────────────────────────────────────────────────────

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
  if (
    m.includes("sign in") ||
    m.includes("login") ||
    m.includes("private") ||
    m.includes("confirm you're not a bot")
  )
    return "This content is private or requires login. Only public links are supported.";
  if (m.includes("not found") || m.includes("404")) return "Content not found.";
  if (m.includes("rate") || m.includes("429"))
    return "Too many requests. Please wait a moment and try again.";
  if (m.includes("unavailable"))
    return "This video is unavailable in your region or has been removed.";
  if (m.includes("unsupported url"))
    return "This URL is not supported. Please check the link.";
  return "Could not fetch media. Ensure the link is public and properly formatted.";
};

const withRetry = async (fn, maxAttempts = 3, delay = 1500) => {
  let lastError;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      console.log(`🔄 Attempt ${attempt}/${maxAttempts}...`);
      return await fn();
    } catch (err) {
      lastError = err;
      const msg = (err.message || err.stderr || "").toString();
      console.error(`⚠️ Attempt ${attempt} failed:`, msg.slice(0, 200));
      const isTransient =
        /network|timeout|connection|429|temporar|ECONN|503|502/i.test(msg);
      const isFatal = /private|login|not found|404|unsupported/i.test(msg);
      if (isFatal || (!isTransient && attempt === maxAttempts)) throw err;
      if (attempt === maxAttempts) throw err;
      await new Promise((r) => setTimeout(r, delay * attempt));
    }
  }
  throw lastError;
};

// ─── TEMP FILE FINDER ─────────────────────────────────────────────────────────

const findTempFile = (basePath) => {
  if (fs.existsSync(basePath)) return basePath;
  const dir = path.dirname(basePath);
  const base = path.basename(basePath, path.extname(basePath));
  try {
    const files = fs.readdirSync(dir).filter((f) => f.startsWith(base));
    // Prefer non-fragment final files
    const finalFile = files.find(
      (f) =>
        !f.endsWith(".part") &&
        !f.endsWith(".ytdl") &&
        !/\.f\d+\./.test(f) &&
        !f.endsWith(".temp"),
    );
    if (finalFile) return path.join(dir, finalFile);
    // Fallback: any file with the base
    if (files.length > 0) return path.join(dir, files[0]);
  } catch (err) {}
  return null;
};

// ─── getMediaInfo ─────────────────────────────────────────────────────────────

const getMediaInfo = async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: "URL is required" });

  try {
    let targetUrl = cleanUrl(url);
    const platform = detectPlatform(targetUrl);

    if (platform === "youtube") targetUrl = normalizeYouTubeUrl(targetUrl);
    else if (platform === "facebook")
      targetUrl = normalizeFacebookUrl(targetUrl);
    else if (platform === "instagram")
      targetUrl = normalizeInstagramUrl(targetUrl);

    console.log(`📡 [INFO] Platform: ${platform} | URL: ${targetUrl}`);

    const options = getPlatformOptions(platform);

    const output = await withRetry(() =>
      youtubedl(targetUrl, { ...options, dumpSingleJson: true }),
    );

    const durationSec = output.duration || 0;
    const formats = Array.isArray(output.formats) ? output.formats : [];
    const VALID_EXTS = new Set(["mp4", "m4a", "webm", "mkv", "mp3"]);
    const uniqueFormats = new Map();

    formats
      .filter((f) => {
        const hasV = f.vcodec && f.vcodec !== "none";
        const hasA = f.acodec && f.acodec !== "none";

        // For IG/FB: prefer progressive (combined) formats
        if (platform === "facebook" || platform === "instagram") {
          return hasV; // keep anything with video; we'll merge audio if needed
        }
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
        format_id: "best",
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

    return res.json({
      title: output.title || "Video",
      description: output.description || "",
      thumbnail: output.thumbnail || null,
      duration: durationSec,
      platform,
      formats: cleanFormats,
    });
  } catch (error) {
    const msg = (error.stderr || error.message || "").toString();
    console.error("❌ [INFO ERROR]:", msg.slice(0, 500));
    return res.status(500).json({ error: friendlyError(msg) });
  }
};

// ─── downloadMedia ────────────────────────────────────────────────────────────

const downloadMedia = async (req, res) => {
  const { url, format_id, title } = req.query;

  console.log("\n==========================================");
  console.log("🚀 [DOWNLOAD] INITIALIZING...");

  if (!url) return res.status(400).send("Missing URL");

  const safeTitle =
    (title || "download").replace(/[^\w\s\-]/gi, "").trim() || "download";
  let targetUrl = cleanUrl(url);
  const platform = detectPlatform(targetUrl);

  if (platform === "youtube") targetUrl = normalizeYouTubeUrl(targetUrl);
  else if (platform === "facebook") targetUrl = normalizeFacebookUrl(targetUrl);
  else if (platform === "instagram")
    targetUrl = normalizeInstagramUrl(targetUrl);

  console.log(`📡 Platform: ${platform} | URL: ${targetUrl}`);

  const options = getPlatformOptions(platform);

  // ═══ FORMAT STRING LOGIC ═══
  let formatStr;

  if (platform === "youtube") {
    if (format_id && format_id !== "best" && format_id !== "undefined") {
      // Specific video format + best audio, merge
      formatStr = `${format_id}+bestaudio[ext=m4a]/${format_id}+bestaudio/best[ext=mp4]/best`;
    } else {
      formatStr =
        "bestvideo[ext=mp4]+bestaudio[ext=m4a]/bestvideo+bestaudio/best[ext=mp4]/best";
    }
  } else if (platform === "instagram") {
    // Instagram reels/posts often come as progressive. Try specific first, fallback to best combined.
    if (format_id && format_id !== "best" && format_id !== "undefined") {
      formatStr = `${format_id}+bestaudio/${format_id}/best[ext=mp4]/best`;
    } else {
      formatStr = "best[ext=mp4]/bestvideo+bestaudio/best";
    }
  } else if (platform === "facebook") {
    // Facebook: prefer combined progressive
    if (format_id && format_id !== "best" && format_id !== "undefined") {
      formatStr = `${format_id}/best[ext=mp4]/best`;
    } else {
      formatStr = "best[ext=mp4]/bestvideo+bestaudio/best";
    }
  } else {
    formatStr =
      format_id && format_id !== "best" && format_id !== "undefined"
        ? `${format_id}+bestaudio/${format_id}/best`
        : "bestvideo+bestaudio/best";
  }

  console.log(`🎯 Format string: ${formatStr}`);

  const tempBase = `udl_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const tempFilePath = path.join(os.tmpdir(), `${tempBase}.mp4`);

  const cleanup = () => {
    try {
      const dir = path.dirname(tempFilePath);
      const base = path.basename(tempFilePath, path.extname(tempFilePath));
      fs.readdirSync(dir)
        .filter((f) => f.startsWith(base))
        .forEach((f) => {
          try {
            fs.unlinkSync(path.join(dir, f));
          } catch (_) {}
        });
    } catch (e) {}
  };

  try {
    const ytdlpOptions = {
      ...options,
      format: formatStr,
      output: tempFilePath,
      mergeOutputFormat: "mp4",
      // Ensure final container is mp4 with AAC audio for browser compatibility
      postprocessorArgs: "ffmpeg:-c:v copy -c:a aac -movflags +faststart",
    };

    console.log("⏳ Running yt-dlp download...");
    await withRetry(() => youtubedl(targetUrl, ytdlpOptions), 2, 2000);

    const actualFile = findTempFile(tempFilePath);
    if (!actualFile) throw new Error("Output file was not created by yt-dlp.");

    const stat = fs.statSync(actualFile);
    console.log(`📊 File size: ${(stat.size / 1_048_576).toFixed(2)} MB`);

    if (stat.size === 0) {
      cleanup();
      throw new Error("Downloaded file is empty. Video may be unavailable.");
    }

    const ext = path.extname(actualFile).slice(1) || "mp4";
    const mimeTypes = {
      mp4: "video/mp4",
      mkv: "video/x-matroska",
      webm: "video/webm",
      m4a: "audio/mp4",
      mp3: "audio/mpeg",
    };

    res.setHeader("Content-Type", mimeTypes[ext] || "video/mp4");
    res.setHeader("Content-Length", stat.size);
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${safeTitle}.${ext}"`,
    );

    const stream = fs.createReadStream(actualFile);
    stream.pipe(res);

    stream.on("error", () => cleanup());
    res.on("finish", () => cleanup());
    res.on("close", () => cleanup());
  } catch (error) {
    const msg = (error.stderr || error.message || "").toString();
    console.error("❌ [DOWNLOAD ERROR]:", msg.slice(0, 500));
    cleanup();
    if (!res.headersSent) res.status(500).send(friendlyError(msg));
  }
};

module.exports = { getMediaInfo, downloadMedia };
