const express = require("express");
const router = express.Router();

/* =========================
   INVITE CODES (CASE SAFE)
========================= */
const validCodes = [
  "OC-BETA-01",
  "OC-BETA-02",
  "OC-BETA-03",
  "OC-BETA-04",
  "OC-BETA-05",
  "OC-BETA-06",
  "OC-BETA-07",
  "OC-BETA-08",
  "OC-BETA-09",
  "OC-BETA-10"
];

/* =========================
   VERIFY
========================= */
router.post("/verify", (req, res) => {
  try {
    let { code } = req.body;

    if (!code) {
      return res.status(400).json({
        success: false,
        error: "No code provided"
      });
    }

    // normalize fully
    code = code.trim().toUpperCase();

    if (!validCodes.includes(code)) {
      return res.status(400).json({
        success: false,
        error: "Invalid invite code"
      });
    }

    return res.json({
      success: true
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({
      success: false,
      error: "Server error"
    });
  }
});

module.exports = router;