const express = require("express");
const router = express.Router();
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

/* REAL INSIGHTS */
router.get("/", async (req, res) => {
  try {

    const decisions = await prisma.decision.findMany({
      include: { evaluations: true }
    });

    const totalDecisions = decisions.length;

    let evaluatedDecisions = 0;

    decisions.forEach(d => {
      if (d.evaluations && d.evaluations.length > 0) {
        evaluatedDecisions++;
      }
    });

    return res.json({
      totalDecisions,
      evaluatedDecisions,
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