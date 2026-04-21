// File: src/utils/helpers.js

// Tracking/noise parameters to strip from URLs
const TRACKING_PARAMS = [
  "si",
  "igshid",
  "igsh",
  "fbclid",
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "ref",
  "referer",
  "_rdc",
  "_rdr",
  "__cft__",
  "__tn__",
  "eid",
  "paipv",
  "eav",
  "app",
  "s",
  "r",
  "mibextid",
  "extid",
];

/**
 * Cleans a URL by removing known tracking/noise query parameters.
 * Supports YouTube, Facebook, Instagram, and generic URLs.
 */
const cleanUrl = (rawUrl) => {
  if (!rawUrl || typeof rawUrl !== "string") return rawUrl;

  const trimmed = rawUrl.trim();

  try {
    const parsedUrl = new URL(trimmed);

    // Strip all known tracking parameters
    TRACKING_PARAMS.forEach((param) => parsedUrl.searchParams.delete(param));

    // ── Facebook-specific normalization ──────────────────────────────────
    // Convert /watch/?v=ID to a clean watchable URL
    if (/facebook\.com/i.test(parsedUrl.hostname)) {
      const vParam = parsedUrl.searchParams.get("v");
      if (vParam && parsedUrl.pathname === "/watch/") {
        // Keep only the v param for clean FB watch URLs
        const cleanFb = new URL("https://www.facebook.com/watch/");
        cleanFb.searchParams.set("v", vParam);
        return cleanFb.toString();
      }
    }

    // ── Instagram-specific normalization ─────────────────────────────────
    // Keep only the path (remove all query params for IG reels/posts)
    if (/instagram\.com/i.test(parsedUrl.hostname)) {
      // Strip all query params for Instagram — they are all tracking
      parsedUrl.search = "";
    }

    return parsedUrl.toString();
  } catch (e) {
    // If URL parsing fails, return as-is
    return trimmed;
  }
};

module.exports = { cleanUrl };
