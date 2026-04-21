// File: src/routes/mediaRoutes.js

const express = require("express");
const router = express.Router();
const {
  getMediaInfo,
  downloadMedia,
} = require("../controllers/mediaController");

// POST request for metadata
router.post("/info", getMediaInfo);

// GET request for downloading file
router.get("/download", downloadMedia);

module.exports = router;
