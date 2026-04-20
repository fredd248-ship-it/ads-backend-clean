const express = require("express");
const router = express.Router();

/* 🔐 SAME CODES AS AUTH */
const VALID_CODES = ["TEST123", "BETA2026"];

router.post("/validate", (req, res) => {
  const { code } = req.body;

  if (!code || !VALID_CODES.includes(code)) {
    return res.status(400).json({
      success: false,
      error: "Invalid code"
    });
  }

  return res.json({
    success: true
  });
});

module.exports = router;