const youtubedl = require("youtube-dl-exec");
const path = require("path");
const ffmpegBin = require("ffmpeg-static");
const fs = require("fs");
const os = require("os");
const { execFile } = require("child_process");
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
    if (shortsMatch) return `https://www.youtube.com/watch?v=${shortsMatch[1]}`;
    const videoId = u.searchParams.get("v");
    if (videoId && u.hostname.includes("youtube.com"))
      return `https://www.youtube.com/watch?v=${videoId}`;
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
    u.search = "";
    u.hash = "";
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
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
const UA_INSTAGRAM_MOBILE =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";

// ─── BASE OPTIONS ─────────────────────────────────────────────────────────────
const BASE = {
  ffmpegLocation: ffmpegBin,
  noCheckCertificates: true,
  noWarnings: true,
  retries: 3,
  fragmentRetries: 3,
  socketTimeout: 30,
  noPlaylist: true,
  bufferSize: "16K",
  preferFreeFormats: true,
};

const PLATFORM_OPTIONS = {
  youtube: {
    ...BASE,
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
  if (m.includes("no video formats"))
    return "No downloadable formats found. The content may be restricted.";
  return "Could not fetch media. Ensure the link is public and properly formatted.";
};

const withRetry = async (fn, maxAttempts = 2, delay = 1500) => {
  let lastError;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      console.log(`🔄 Attempt ${attempt}/${maxAttempts}...`);
      return await fn();
    } catch (err) {
      lastError = err;
      const msg = (err.message || err.stderr || "").toString();
      console.error(`⚠️ Attempt ${attempt} failed:`, msg.slice(0, 200));
      const isFatal = /private|login|not found|404|unsupported/i.test(msg);
      if (isFatal || attempt === maxAttempts) throw err;
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
    // Prefer non-partial, non-temp files first
    const finalFile = files.find(
      (f) =>
        !f.endsWith(".part") &&
        !f.endsWith(".ytdl") &&
        !/\.f\d+\./.test(f) &&
        !f.endsWith(".temp"),
    );
    if (finalFile) return path.join(dir, finalFile);
    if (files.length > 0) return path.join(dir, files[0]);
  } catch (_) {}
  return null;
};

// ─── PROBE: Check if a file has an audio stream via ffprobe ──────────────────
const probeHasAudio = (filePath) => {
  return new Promise((resolve) => {
    // ffmpeg-static ships ffmpeg; ffprobe is usually alongside it
    const ffprobePath = ffmpegBin.replace(/ffmpeg(\.exe)?$/, "ffprobe$1");
    const args = [
      "-v",
      "error",
      "-select_streams",
      "a:0",
      "-show_entries",
      "stream=codec_type",
      "-of",
      "default=noprint_wrappers=1:nokey=1",
      filePath,
    ];
    execFile(ffprobePath, args, (err, stdout) => {
      if (err) {
        // ffprobe not available — assume audio exists, let ffmpeg fail naturally
        console.warn("⚠️ ffprobe not available, skipping audio probe");
        resolve(true);
        return;
      }
      resolve(stdout.trim().toLowerCase() === "audio");
    });
  });
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
        if (platform === "facebook" || platform === "instagram") return hasV;
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
  if (!url) return res.status(400).send("Missing URL");

  console.log("\n==========================================");
  console.log("🚀 [DOWNLOAD] INITIALIZING...");

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

  let formatStr;
  if (platform === "youtube") {
    if (format_id && format_id !== "best" && format_id !== "undefined") {
      formatStr = `${format_id}+bestaudio[ext=m4a]/${format_id}+bestaudio/best[ext=mp4]/best`;
    } else {
      formatStr =
        "bestvideo[ext=mp4]+bestaudio[ext=m4a]/bestvideo+bestaudio/best[ext=mp4]/best";
    }
  } else if (platform === "instagram") {
    if (format_id && format_id !== "best" && format_id !== "undefined") {
      formatStr = `${format_id}/best[ext=mp4]/best`;
    } else {
      formatStr = "best[ext=mp4]/best";
    }
  } else if (platform === "facebook") {
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
    } catch (_) {}
  };

  try {
    const ytdlpOptions = {
      ...options,
      format: formatStr,
      output: tempFilePath,
      mergeOutputFormat: "mp4",
      postprocessorArgs: "ffmpeg:-c:v copy -c:a aac -movflags +faststart",
    };

    console.log("⏳ Running yt-dlp download...");
    await withRetry(() => youtubedl(targetUrl, ytdlpOptions), 2, 2000);

    const actualFile = findTempFile(tempFilePath);
    if (!actualFile) throw new Error("Output file was not created by yt-dlp.");

    const stat = fs.statSync(actualFile);
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

// ─── getAudioInfo ─────────────────────────────────────────────────────────────
const getAudioInfo = async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: "URL is required" });

  if (/instagram\.com\/reels\/audio\//i.test(url)) {
    return res.status(400).json({
      error:
        "Instagram audio-page links cannot be downloaded directly. " +
        "Please open an actual Reel that uses this audio, copy that Reel's URL, and paste it here instead.",
    });
  }

  try {
    let targetUrl = cleanUrl(url);
    const platform = detectPlatform(targetUrl);

    if (platform === "youtube") targetUrl = normalizeYouTubeUrl(targetUrl);
    else if (platform === "facebook")
      targetUrl = normalizeFacebookUrl(targetUrl);
    else if (platform === "instagram")
      targetUrl = normalizeInstagramUrl(targetUrl);

    console.log(`🎵 [AUDIO INFO] Platform: ${platform} | URL: ${targetUrl}`);

    const options = getPlatformOptions(platform);
    const output = await withRetry(() =>
      youtubedl(targetUrl, { ...options, dumpSingleJson: true }),
    );

    const durationSec = output.duration || 0;
    const formats = Array.isArray(output.formats) ? output.formats : [];

    let audioFormats = formats
      .filter((f) => {
        const hasAudio = f.acodec && f.acodec !== "none";
        const noVideo = !f.vcodec || f.vcodec === "none";
        return hasAudio && noVideo;
      })
      .map((f) => {
        const toMB = (bytes) => `${(bytes / 1_048_576).toFixed(1)} MB`;
        let sizeString = "";
        if (f.filesize) sizeString = toMB(f.filesize);
        else if (f.filesize_approx) sizeString = `~${toMB(f.filesize_approx)}`;
        else if (f.tbr && durationSec) {
          const est = (f.tbr * 1000 * durationSec) / 8;
          sizeString = `~${toMB(est)}`;
        }
        return {
          format_id: f.format_id,
          ext: f.ext || "m4a",
          abr: f.abr || f.tbr || 0,
          acodec: f.acodec,
          filesize: sizeString,
          quality: f.abr
            ? `${Math.round(f.abr)}kbps`
            : f.tbr
              ? `~${Math.round(f.tbr)}kbps`
              : "Audio",
        };
      })
      .sort((a, b) => (b.abr || 0) - (a.abr || 0));

    if (audioFormats.length === 0) {
      const combinedWithAudio = formats
        .filter((f) => f.acodec && f.acodec !== "none")
        .sort((a, b) => {
          const aSize = a.filesize || a.filesize_approx || 0;
          const bSize = b.filesize || b.filesize_approx || 0;
          return bSize - aSize;
        });

      if (combinedWithAudio.length > 0) {
        const best = combinedWithAudio[0];
        const toMB = (bytes) => `${(bytes / 1_048_576).toFixed(1)} MB`;
        let sizeString = "";
        if (best.filesize) sizeString = toMB(best.filesize);
        else if (best.filesize_approx)
          sizeString = `~${toMB(best.filesize_approx)}`;

        audioFormats.push({
          format_id: best.format_id,
          ext: best.ext || "mp4",
          abr: best.abr || best.tbr || 128,
          acodec: best.acodec || "aac",
          filesize: sizeString,
          quality: "Best Available",
          isFromCombined: true,
        });
      }
    }

    if (audioFormats.length === 0) {
      audioFormats.push({
        format_id: "bestaudio/best",
        ext: "m4a",
        abr: 0,
        quality: "Best Available",
        filesize: "",
      });
    }

    const seen = new Set();
    const uniqueAudio = audioFormats.filter((f) => {
      const bucket = Math.round((f.abr || 0) / 32) * 32;
      const key = `${bucket}_${f.ext}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    return res.json({
      title: output.title || "Audio",
      thumbnail: output.thumbnail || null,
      duration: durationSec,
      platform,
      audioFormats: uniqueAudio,
    });
  } catch (error) {
    const msg = (error.stderr || error.message || "").toString();
    console.error("❌ [AUDIO INFO ERROR]:", msg.slice(0, 500));
    return res.status(500).json({ error: friendlyError(msg) });
  }
};

// ─── downloadAudio ────────────────────────────────────────────────────────────
// FIX: Instagram/Facebook reels often have NO standalone audio stream.
// Strategy:
//   1. For Instagram/Facebook: always download the best combined stream (video+audio).
//   2. Probe the downloaded file with ffprobe to confirm an audio stream exists.
//   3. If probe fails or no audio found, retry with a broader format selector.
//   4. Extract audio with ffmpeg using -map 0:a:0 (explicit audio stream map)
//      instead of relying on -vn which silently fails on some containers.
//   5. Surface a clear, user-friendly error if truly no audio track exists.
const downloadAudio = async (req, res) => {
  const { url, format_id, title, startTime, endTime } = req.query;

  console.log("\n==========================================");
  console.log("🎵 [AUDIO DOWNLOAD] INITIALIZING...");
  console.log(
    `   format_id: ${format_id}, startTime: ${startTime}, endTime: ${endTime}`,
  );

  if (!url) return res.status(400).send("Missing URL");

  const safeTitle =
    (title || "audio").replace(/[^\w\s\-]/gi, "").trim() || "audio";
  let targetUrl = cleanUrl(url);
  const platform = detectPlatform(targetUrl);

  if (platform === "youtube") targetUrl = normalizeYouTubeUrl(targetUrl);
  else if (platform === "facebook") targetUrl = normalizeFacebookUrl(targetUrl);
  else if (platform === "instagram")
    targetUrl = normalizeInstagramUrl(targetUrl);

  const options = getPlatformOptions(platform);

  // ── Format selection strategy ─────────────────────────────────────────────
  // For Instagram & Facebook: Instagram Reels encode audio INTO the video stream.
  // Pure audio-only streams often don't exist or have no audio.
  // We MUST download the combined video+audio file, then strip audio via ffmpeg.
  //
  // Priority order we try:
  //   1. best[ext=mp4]  — combined mp4 (most common for Reels)
  //   2. best           — whatever yt-dlp picks as best overall
  //   3. bestvideo+bestaudio — merged (fallback, may need mux)
  //
  // For YouTube: prefer a real audio-only stream, fall back to combined.
  // For others: try audio-only first, fall back to combined.

  const formatCandidates =
    platform === "instagram" || platform === "facebook"
      ? [
          "best[ext=mp4][acodec!=none]", // best mp4 that has audio declared
          "best[ext=mp4]", // best mp4 regardless
          "best[acodec!=none]", // best anything with audio
          "best", // absolute fallback
        ]
      : platform === "youtube"
        ? [
            format_id &&
            format_id !== "bestaudio" &&
            format_id !== "undefined" &&
            format_id !== "best" &&
            format_id !== "auto"
              ? `${format_id}/bestaudio[ext=m4a]/bestaudio[ext=mp3]/bestaudio/best`
              : "bestaudio[ext=m4a]/bestaudio[ext=mp3]/bestaudio/best",
          ]
        : [
            format_id &&
            format_id !== "bestaudio" &&
            format_id !== "undefined" &&
            format_id !== "best" &&
            format_id !== "auto"
              ? `${format_id}/bestaudio[ext=m4a]/bestaudio/best`
              : "bestaudio[ext=m4a]/bestaudio/best",
          ];

  const tempBase = `aud_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const tempRawPath = path.join(os.tmpdir(), `${tempBase}_raw`);
  const tempMp3Path = path.join(os.tmpdir(), `${tempBase}.mp3`);

  const cleanupFiles = (...extra) => {
    const dir = os.tmpdir();
    const base = path.basename(tempRawPath);
    try {
      fs.readdirSync(dir)
        .filter((f) => f.startsWith(base))
        .forEach((f) => {
          try {
            fs.unlinkSync(path.join(dir, f));
          } catch (_) {}
        });
    } catch (_) {}
    for (const f of extra) {
      try {
        if (fs.existsSync(f)) fs.unlinkSync(f);
      } catch (_) {}
    }
  };

  // ── Try each format candidate until one produces a file with audio ─────────
  let actualRawFile = null;

  for (let ci = 0; ci < formatCandidates.length; ci++) {
    const formatStr = formatCandidates[ci];
    if (!formatStr) continue;

    console.log(
      `🎯 [Attempt ${ci + 1}/${formatCandidates.length}] Format: ${formatStr}`,
    );

    const ytdlpOptions = {
      ...options,
      format: formatStr,
      output: `${tempRawPath}.%(ext)s`,
    };

    try {
      await withRetry(() => youtubedl(targetUrl, ytdlpOptions), 2, 2000);
    } catch (dlErr) {
      console.warn(
        `⚠️ yt-dlp failed for format "${formatStr}":`,
        (dlErr.message || "").slice(0, 150),
      );
      // Clean up any partial files before next attempt
      cleanupFiles();
      continue;
    }

    // Find the downloaded file
    const found = findTempFile(tempRawPath);
    if (!found) {
      console.warn(`⚠️ No output file found for format "${formatStr}"`);
      continue;
    }

    const stat = fs.statSync(found);
    if (stat.size === 0) {
      console.warn(`⚠️ Empty file for format "${formatStr}"`);
      try {
        fs.unlinkSync(found);
      } catch (_) {}
      continue;
    }

    console.log(
      `✅ Downloaded: ${(stat.size / 1_048_576).toFixed(2)} MB — probing for audio...`,
    );

    // Probe for audio stream
    const hasAudio = await probeHasAudio(found);
    if (!hasAudio) {
      console.warn(
        `⚠️ No audio stream in file for format "${formatStr}" — trying next candidate`,
      );
      try {
        fs.unlinkSync(found);
      } catch (_) {}
      continue;
    }

    actualRawFile = found;
    console.log(`✅ Audio stream confirmed in: ${actualRawFile}`);
    break;
  }

  if (!actualRawFile) {
    cleanupFiles();
    const userMsg =
      platform === "instagram" || platform === "facebook"
        ? "This Reel/video has no audio track. Instagram Reels with only music overlays may not be extractable."
        : "Could not find a downloadable audio stream. The video may have no audio.";
    if (!res.headersSent) return res.status(500).send(userMsg);
    return;
  }

  // ── ffmpeg: extract audio → MP3 ───────────────────────────────────────────
  const start = parseFloat(startTime);
  const end = parseFloat(endTime);
  const hasTrim = !isNaN(start) && !isNaN(end) && end > start;

  const ffmpegArgs = ["-y", "-loglevel", "error", "-i", actualRawFile];

  if (hasTrim) {
    console.log(`✂️  Trimming: ${start}s → ${end}s`);
    ffmpegArgs.push("-ss", String(start), "-to", String(end));
  }

  ffmpegArgs.push(
    // Explicitly map the first audio stream — more reliable than -vn
    // because -vn only suppresses video output; if the container is
    // unusual, ffmpeg may still error. -map 0:a:0 is unambiguous.
    "-map",
    "0:a:0",
    "-acodec",
    "libmp3lame",
    "-ab",
    "192k",
    "-ar",
    "44100",
    tempMp3Path,
  );

  try {
    await new Promise((resolve, reject) => {
      execFile(ffmpegBin, ffmpegArgs, (err, _stdout, stderr) => {
        if (err) {
          console.error("❌ FFmpeg stderr:", stderr);
          reject(new Error(`FFmpeg failed: ${(stderr || "").slice(0, 300)}`));
        } else {
          resolve();
        }
      });
    });
  } catch (ffErr) {
    // ── FALLBACK: if -map 0:a:0 failed, try with -vn (legacy approach) ──────
    console.warn("⚠️ -map 0:a:0 failed, retrying with -vn fallback...");
    const fallbackArgs = [
      "-y",
      "-loglevel",
      "error",
      "-i",
      actualRawFile,
      ...(hasTrim ? ["-ss", String(start), "-to", String(end)] : []),
      "-vn",
      "-acodec",
      "libmp3lame",
      "-ab",
      "192k",
      "-ar",
      "44100",
      tempMp3Path,
    ];

    try {
      await new Promise((resolve, reject) => {
        execFile(ffmpegBin, fallbackArgs, (err2, _stdout, stderr2) => {
          if (err2) {
            console.error("❌ FFmpeg fallback stderr:", stderr2);
            reject(
              new Error(
                `Audio extraction failed. The Reel may not have an extractable audio track.`,
              ),
            );
          } else {
            resolve();
          }
        });
      });
    } catch (finalErr) {
      cleanupFiles(tempMp3Path);
      if (!res.headersSent) return res.status(500).send(finalErr.message);
      return;
    }
  }

  // Verify MP3 output
  if (!fs.existsSync(tempMp3Path)) {
    cleanupFiles();
    if (!res.headersSent)
      return res.status(500).send("MP3 conversion produced no output file.");
    return;
  }

  const mp3Stat = fs.statSync(tempMp3Path);
  if (mp3Stat.size === 0) {
    cleanupFiles(tempMp3Path);
    if (!res.headersSent)
      return res
        .status(500)
        .send("Converted MP3 is empty — no audio data extracted.");
    return;
  }

  console.log(`✅ MP3 ready: ${(mp3Stat.size / 1_048_576).toFixed(2)} MB`);

  const downloadName = hasTrim
    ? `${safeTitle}_ringtone.mp3`
    : `${safeTitle}.mp3`;

  res.setHeader("Content-Type", "audio/mpeg");
  res.setHeader("Content-Length", mp3Stat.size);
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${downloadName}"`,
  );

  const stream = fs.createReadStream(tempMp3Path);
  stream.pipe(res);
  stream.on("error", () => cleanupFiles(tempMp3Path));
  res.on("finish", () => cleanupFiles(tempMp3Path));
  res.on("close", () => cleanupFiles(tempMp3Path));
};

// ─── searchSong ───────────────────────────────────────────────────────────────
const searchSong = async (req, res) => {
  const { query } = req.query;
  if (!query || !query.trim())
    return res.status(400).json({ error: "Search query is required" });

  try {
    console.log(`🔍 [SONG SEARCH] Query: "${query}"`);

    const searchUrl = `ytsearch8:${query.trim()}`;

    let output;
    try {
      output = await youtubedl(searchUrl, {
        ...PLATFORM_OPTIONS.youtube,
        dumpSingleJson: true,
        flatPlaylist: true,
        noPlaylist: false,
        ignoreErrors: true,
        skipDownload: true,
      });
    } catch (primaryErr) {
      console.warn("⚠️ Primary search failed, trying fallback...");
      output = await youtubedl(searchUrl, {
        ...PLATFORM_OPTIONS.youtube,
        dumpSingleJson: true,
        noPlaylist: false,
        ignoreErrors: true,
        skipDownload: true,
      });
    }

    let entries = [];
    if (Array.isArray(output?.entries) && output.entries.length > 0) {
      entries = output.entries;
    } else if (output?.id || output?.webpage_url) {
      entries = [output];
    }

    if (entries.length === 0) {
      console.log("⚠️ No entries found in search output");
      return res.json({ results: [] });
    }

    const results = entries
      .filter((e) => e && (e.id || e.url || e.webpage_url))
      .slice(0, 8)
      .map((e) => {
        let thumbnail = e.thumbnail || null;
        if (
          !thumbnail &&
          Array.isArray(e.thumbnails) &&
          e.thumbnails.length > 0
        ) {
          const sorted = [...e.thumbnails].sort(
            (a, b) =>
              (b.width || 0) * (b.height || 0) -
              (a.width || 0) * (a.height || 0),
          );
          thumbnail = sorted[0]?.url || null;
        }
        const videoId = e.id || e.url?.match(/[?&]v=([^&]+)/)?.[1] || null;
        if (!thumbnail && videoId) {
          thumbnail = `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`;
        }

        const pageUrl =
          e.webpage_url ||
          e.url ||
          (videoId ? `https://www.youtube.com/watch?v=${videoId}` : null);

        return {
          id: videoId || e.display_id || "",
          title: e.title || e.fulltitle || "Unknown",
          duration: e.duration || 0,
          thumbnail,
          url: pageUrl || "",
          uploader: e.uploader || e.channel || e.uploader_id || "",
          view_count: e.view_count || 0,
        };
      })
      .filter((r) => r.url && r.id);

    console.log(`✅ Found ${results.length} results`);
    return res.json({ results });
  } catch (error) {
    const msg = (error.stderr || error.message || "").toString();
    console.error("❌ [SEARCH ERROR]:", msg.slice(0, 500));
    return res.status(500).json({
      error: "Song search failed. Please try again.",
    });
  }
};

module.exports = {
  getMediaInfo,
  downloadMedia,
  getAudioInfo,
  downloadAudio,
  searchSong,
};
