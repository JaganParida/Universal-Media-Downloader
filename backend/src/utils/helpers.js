// helpers.js
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
    TRACKING_PARAMS.forEach((param) => parsedUrl.searchParams.delete(param));

    // ── Facebook-specific normalization ──────────────────────────────────
    if (/facebook\.com/i.test(parsedUrl.hostname)) {
      const vParam = parsedUrl.searchParams.get("v");
      if (vParam && parsedUrl.pathname === "/watch/") {
        const cleanFb = new URL("https://www.facebook.com/watch/");
        cleanFb.searchParams.set("v", vParam);
        return cleanFb.toString();
      }
    }

    // ── Instagram-specific normalization ─────────────────────────────────
    // Strip all query params for Instagram — they are all tracking
    if (/instagram\.com/i.test(parsedUrl.hostname)) {
      parsedUrl.search = "";
    }

    return parsedUrl.toString();
  } catch (e) {
    return trimmed;
  }
};

module.exports = { cleanUrl };
