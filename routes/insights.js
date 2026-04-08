const express = require("express");
const router = express.Router();

/* BASIC INSIGHTS (SAFE DEFAULT) */
router.get("/", async (req, res) => {
  try {

    return res.json({
      totalDecisions: 0,
      evaluatedDecisions: 0,
      insightSummary: {},
      behaviorReport: {},
      categoryInsights: []
    });

  } catch (error) {
    console.error("INSIGHTS ERROR:", error);
    return res.status(500).json({
      error: "Server error"
    });
  }
});

module.exports = router;