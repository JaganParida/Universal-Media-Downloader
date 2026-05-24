const express = require("express");
const router = express.Router();
const {
  getMediaInfo,
  downloadMedia,
  getAudioInfo,
  downloadAudio,
  searchSong,
} = require("../controllers/mediaController");

// ─── Existing Routes (UNCHANGED) ─────────────────────────────────────────────
router.post("/info", getMediaInfo);
router.get("/download", downloadMedia);

// ─── New Audio Routes ─────────────────────────────────────────────────────────

// GET audio-only formats from any reel/video URL
router.post("/audio/info", getAudioInfo);

// Download audio as MP3 (with optional trim via startTime & endTime query params)
router.get("/audio/download", downloadAudio);

// Search YouTube for a song by name
router.get("/audio/search", searchSong);

module.exports = router;
