// mediaRoutes.js
const express = require("express");
const router = express.Router();
const {
  getMediaInfo,
  downloadMedia,
  getAudioInfo,
  downloadAudio,
  searchSong,
} = require("../controllers/mediaController");

// ─── Video Routes ──────────────────────────────────────────────────────────────
router.post("/info", getMediaInfo);
router.get("/download", downloadMedia);

// ─── Audio Routes ──────────────────────────────────────────────────────────────
router.post("/audio/info", getAudioInfo);
router.get("/audio/download", downloadAudio);
router.get("/audio/search", searchSong);

module.exports = router;
