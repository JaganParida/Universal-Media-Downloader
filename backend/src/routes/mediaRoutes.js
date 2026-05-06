const express = require("express");
const router = express.Router();
const {
  getMediaInfo,
  downloadMedia,
} = require("../controllers/mediaController");

router.post("/info", getMediaInfo);

router.get("/download", downloadMedia);

module.exports = router;
