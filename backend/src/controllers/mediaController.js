// File: src/controllers/mediaController.js
//
// Robust media downloader — YouTube · Facebook · Instagram · Generic
// Uses yt-dlp (via youtube-dl-exec) with platform-optimised options.

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

// ─── YouTube Shorts URL normalizer ───────────────────────────────────────────

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

// ─── Common User-Agent ────────────────────────────────────────────────────────

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

// ─── Base yt-dlp options shared by all platforms ──────────────────────────────

const BASE = {
  ffmpegLocation: ffmpegBin,
  noCheckCertificates: true,
  noWarnings: true,
  retries: 10,
  fragmentRetries: 10,
  socketTimeout: 60,
  noPlaylist: true,
  bufferSize: "16K",
  concurrentFragments: 4,
};

// ─── Per-platform option sets ─────────────────────────────────────────────────

const PLATFORM_OPTIONS = {
  youtube: {
    ...BASE,
    addHeader: [
      `user-agent:${UA}`,
      "accept-language:en-US,en;q=0.9",
      "accept:text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    ],
    extractorArgs: "youtube:player_client=web",
    geoBypass: true,
    sleepRequests: 1,
  },

  facebook: {
    ...BASE,
    addHeader: [
      `user-agent:${UA}`,
      "accept-language:en-US,en;q=0.9",
      "accept:text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "referer:https://www.facebook.com/",
    ],
    geoBypass: true,
  },

  instagram: {
    ...BASE,
    addHeader: [
      `user-agent:${UA}`,
      "accept-language:en-US,en;q=0.9",
      "accept:text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "referer:https://www.instagram.com/",
    ],
    geoBypass: true,
  },

  twitter: {
    ...BASE,
    addHeader: [
      `user-agent:${UA}`,
      "accept-language:en-US,en;q=0.9",
      "referer:https://twitter.com/",
    ],
    geoBypass: true,
  },

  tiktok: {
    ...BASE,
    addHeader: [
      `user-agent:${UA}`,
      "accept-language:en-US,en;q=0.9",
      "referer:https://www.tiktok.com/",
    ],
  },

  generic: {
    ...BASE,
    addHeader: [`user-agent:${UA}`, "accept-language:en-US,en;q=0.9"],
    geoBypass: true,
  },
};

const getPlatformOptions = (platform) =>
  PLATFORM_OPTIONS[platform] ?? PLATFORM_OPTIONS.generic;

// ─── Resolution bucketing ─────────────────────────────────────────────────────

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

// ─── Size estimation ──────────────────────────────────────────────────────────

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

// ─── Friendly error messages ──────────────────────────────────────────────────

const friendlyError = (rawMessage = "") => {
  const m = rawMessage.toLowerCase();
  if (
    m.includes("sign in") ||
    m.includes("login") ||
    m.includes("log in") ||
    m.includes("age")
  )
    return "This video requires login or age verification. Only public videos can be downloaded.";
  if (m.includes("private"))
    return "This content is private and cannot be downloaded.";
  if (
    m.includes("not found") ||
    m.includes("404") ||
    m.includes("does not exist") ||
    m.includes("no video")
  )
    return "Content not found. The URL may be invalid or the video has been removed.";
  if (m.includes("rate") || m.includes("429") || m.includes("too many"))
    return "Too many requests. Please wait a moment and try again.";
  if (m.includes("copyright") || m.includes("blocked"))
    return "This content is unavailable due to copyright restrictions.";
  if (m.includes("unsupported url"))
    return "This URL is not supported. Please paste a direct link to a public video.";
  if (m.includes("confirm") && m.includes("bot"))
    return "YouTube is asking for bot verification. Please try again in a few minutes.";
  if (
    m.includes("network") ||
    m.includes("connection") ||
    m.includes("timeout")
  )
    return "Network error while fetching the video. Please check your connection and try again.";
  if (m.includes("unable to extract") || m.includes("no video formats"))
    return "Could not extract video. The video may be region-restricted or private.";
  return "Could not fetch media. Make sure it is a valid, public video link.";
};

// ─── Retry helper ─────────────────────────────────────────────────────────────

const withRetry = async (fn, maxAttempts = 3, delay = 2000) => {
  let lastError;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      const msg = (err.message || "").toLowerCase();
      const isTransient =
        msg.includes("network") ||
        msg.includes("timeout") ||
        msg.includes("connection") ||
        msg.includes("429") ||
        msg.includes("rate") ||
        msg.includes("too many") ||
        msg.includes("fragment") ||
        msg.includes("http error 5");

      if (!isTransient || attempt === maxAttempts) throw err;
      const wait = delay * attempt;
      console.warn(
        `⚠️  Attempt ${attempt} failed (${err.message}). Retrying in ${wait}ms…`,
      );
      await new Promise((r) => setTimeout(r, wait));
    }
  }
  throw lastError;
};

// ─── Temp-file finder ─────────────────────────────────────────────────────────

const findTempFile = (basePath) => {
  if (fs.existsSync(basePath)) return basePath;
  const dir = path.dirname(basePath);
  const base = path.basename(basePath, path.extname(basePath));
  try {
    const files = fs.readdirSync(dir).filter((f) => f.startsWith(base));
    if (files.length > 0) return path.join(dir, files[0]);
  } catch (_) {}
  return null;
};

// ─── Build format string per platform ────────────────────────────────────────
//
// ROOT CAUSE OF FACEBOOK NO-AUDIO BUG:
//   Facebook CDN serves video and audio as completely separate DASH streams.
//   e.g. format "dash_sd_src" = video only, "dash_sd_src_no_ratelimit" = video only
//   The ONLY way to get audio is to pick a format that has acodec != "none",
//   OR to explicitly merge video + audio streams using yt-dlp's + syntax.
//
// THE FIX:
//   1. NEVER pass a bare format_id for Facebook — it's almost always video-only.
//   2. ALWAYS append "+bestaudio" to force yt-dlp to fetch audio separately
//      and merge it via ffmpeg.
//   3. Use "b" (best single file) only as absolute last resort.
//   4. Remove postprocessorArgs entirely for Facebook — letting yt-dlp/ffmpeg
//      handle the merge natively is more reliable than injecting extra flags.

const buildFormatString = (platform, format_id) => {
  // ── YouTube ───────────────────────────────────────────────────────────────
  if (platform === "youtube") {
    if (format_id === "bv*+ba/b" || format_id === "best") {
      return [
        "bv*[vcodec^=avc1][ext=mp4]+ba[ext=m4a]",
        "bv*[ext=mp4]+ba[ext=m4a]",
        "bv*[vcodec^=avc1]+ba",
        "bv*+ba",
        "b[ext=mp4]",
        "b",
      ].join("/");
    }
    return [
      `${format_id}[ext=mp4]+bestaudio[ext=m4a]`,
      `${format_id}+bestaudio[ext=m4a]`,
      `${format_id}+bestaudio`,
      `${format_id}`,
      "bv*[vcodec^=avc1][ext=mp4]+ba[ext=m4a]",
      "bv*+ba",
      "b",
    ].join("/");
  }

  // ── Facebook ──────────────────────────────────────────────────────────────
  // CRITICAL: Facebook format_ids are almost ALWAYS video-only DASH streams.
  // We MUST force audio merge. Strategy:
  //   - Try the specific video format + best audio (explicit merge)
  //   - Try best video + best audio (generic merge)
  //   - Try "b" which picks the best single combined stream yt-dlp can find
  // We do NOT try bare `format_id` alone — that would download video-only.
  if (platform === "facebook") {
    if (format_id === "bv*+ba/b" || format_id === "best") {
      return [
        "bestvideo[ext=mp4]+bestaudio[ext=m4a]",
        "bestvideo[ext=mp4]+bestaudio",
        "bestvideo+bestaudio[ext=m4a]",
        "bestvideo+bestaudio",
        "b",
      ].join("/");
    }
    // Specific format_id selected by user (e.g. a particular resolution)
    // Always merge with bestaudio — never trust format_id to have audio
    return [
      `${format_id}+bestaudio[ext=m4a]`,
      `${format_id}+bestaudio`,
      "bestvideo[ext=mp4]+bestaudio[ext=m4a]",
      "bestvideo[ext=mp4]+bestaudio",
      "bestvideo+bestaudio",
      "b",
    ].join("/");
  }

  // ── Instagram ─────────────────────────────────────────────────────────────
  if (platform === "instagram") {
    if (format_id === "bv*+ba/b" || format_id === "best") {
      return [
        "bestvideo[ext=mp4]+bestaudio[ext=m4a]",
        "bestvideo+bestaudio",
        "b[ext=mp4]",
        "b",
      ].join("/");
    }
    return [
      `${format_id}+bestaudio[ext=m4a]`,
      `${format_id}+bestaudio`,
      `${format_id}`,
      "bestvideo+bestaudio",
      "b",
    ].join("/");
  }

  // ── Generic / Twitter / TikTok ────────────────────────────────────────────
  if (format_id === "bv*+ba/b" || format_id === "best") {
    return [
      "bestvideo[ext=mp4]+bestaudio[ext=m4a]",
      "bestvideo+bestaudio",
      "b[ext=mp4]",
      "b",
    ].join("/");
  }
  return [
    `${format_id}+bestaudio[ext=m4a]`,
    `${format_id}+bestaudio`,
    `${format_id}`,
    "bestvideo+bestaudio",
    "b",
  ].join("/");
};

// ─── getMediaInfo ─────────────────────────────────────────────────────────────

const getMediaInfo = async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: "URL is required" });

  try {
    let targetUrl = cleanUrl(url);
    const platform = detectPlatform(targetUrl);

    if (platform === "youtube") {
      targetUrl = normalizeYouTubeUrl(targetUrl);
    }

    const options = getPlatformOptions(platform);
    console.log(`ℹ️  Fetching info for [${platform}]: ${targetUrl}`);

    const output = await withRetry(() =>
      youtubedl(targetUrl, {
        ...options,
        dumpSingleJson: true,
      }),
    );

    const durationSec = output.duration || 0;
    const formats = Array.isArray(output.formats) ? output.formats : [];

    const VALID_EXTS = new Set([
      "mp4",
      "m4a",
      "webm",
      "mov",
      "flv",
      "3gp",
      "mkv",
      "ts",
      "m3u8",
      "mp3",
      "ogg",
    ]);

    const uniqueFormats = new Map();

    formats
      .filter(
        (f) =>
          VALID_EXTS.has((f.ext || "").toLowerCase()) ||
          (f.vcodec && f.vcodec !== "none") ||
          (f.acodec && f.acodec !== "none"),
      )
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

        if (!uniqueFormats.has(key)) {
          uniqueFormats.set(key, {
            ...f,
            cleanRes,
            sortValue,
            sizeString,
            sizeValueForSort,
          });
        } else {
          if (
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
        }
      });

    if (uniqueFormats.size === 0) {
      uniqueFormats.set("Best", {
        format_id: "bv*+ba/b",
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
      .sort((a, b) => {
        if (a.hasVideo && b.hasVideo) return b.sortValue - a.sortValue;
        if (a.hasVideo) return -1;
        if (b.hasVideo) return 1;
        return 0;
      });

    return res.json({
      title: output.title || "Video",
      description: output.description || "",
      thumbnail: output.thumbnail || null,
      duration: durationSec,
      platform,
      formats: cleanFormats,
    });
  } catch (error) {
    console.error("❌ Fetch error:", error.message);
    return res.status(500).json({ error: friendlyError(error.message) });
  }
};

// ─── downloadMedia ────────────────────────────────────────────────────────────

const downloadMedia = async (req, res) => {
  const { url, format_id, title } = req.query;

  if (!url || !format_id) {
    return res.status(400).send("Missing URL or format_id");
  }

  const safeTitle =
    (title || "download").replace(/[^\w\s\-]/gi, "").trim() || "download";
  let targetUrl = cleanUrl(url);
  const platform = detectPlatform(targetUrl);

  if (platform === "youtube") {
    targetUrl = normalizeYouTubeUrl(targetUrl);
  }

  const options = getPlatformOptions(platform);
  const formatStr = buildFormatString(platform, format_id);

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
    } catch (e) {
      console.error("Cleanup error:", e.message);
    }
  };

  try {
    console.log(
      `⬇️  Downloading [${platform}] format="${formatStr}": ${targetUrl}`,
    );

    // Build yt-dlp options — for Facebook we skip postprocessorArgs entirely.
    // Injecting extra ffmpeg flags into a merge operation can interfere with
    // yt-dlp's own stream-merging logic and silently drop the audio track.
    // Let yt-dlp + ffmpeg handle the merge natively via mergeOutputFormat only.
    const downloadOptions = {
      ...options,
      format: formatStr,
      output: tempFilePath,
      mergeOutputFormat: "mp4",
    };

    // For non-Facebook platforms keep the audio re-encode for compatibility
    if (platform !== "facebook" && platform !== "instagram") {
      downloadOptions.postprocessorArgs = "ffmpeg:-c copy -c:a aac";
    }

    await withRetry(() => youtubedl(targetUrl, downloadOptions));

    const actualFile = findTempFile(tempFilePath);
    if (!actualFile) {
      throw new Error("Output file was not created by yt-dlp.");
    }

    const stat = fs.statSync(actualFile);
    if (stat.size === 0) {
      cleanup();
      throw new Error(
        "Downloaded file is empty. The video may be unavailable.",
      );
    }

    console.log(
      `✅ Download ready: ${actualFile} (${(stat.size / 1_048_576).toFixed(1)} MB)`,
    );

    const ext = path.extname(actualFile).slice(1) || "mp4";
    const mimeTypes = {
      mp4: "video/mp4",
      mkv: "video/x-matroska",
      webm: "video/webm",
      mov: "video/quicktime",
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

    stream.on("error", (err) => {
      console.error("Stream error:", err.message);
      cleanup();
    });

    res.on("finish", () => {
      cleanup();
      console.log(`🏁 Sent: ${safeTitle}.${ext}`);
    });

    res.on("close", () => {
      cleanup();
    });
  } catch (error) {
    console.error("❌ Download error:", error.message);
    cleanup();
    if (!res.headersSent) {
      res.status(500).send(friendlyError(error.message));
    }
  }
};

// ─── Exports ──────────────────────────────────────────────────────────────────

module.exports = { getMediaInfo, downloadMedia };
