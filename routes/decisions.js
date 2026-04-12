const express = require("express");
const router = express.Router();
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

/* GET ALL DECISIONS (WITH EVALUATIONS) */
router.get("/", async (req, res) => {
  try {

    const decisions = await prisma.decision.findMany({
      orderBy: { createdAt: "desc" },
      include: { evaluations: true }
    });

    return res.json({
      success: true,
      data: decisions
    });

  } catch (error) {
    console.error("GET DECISIONS ERROR:", error);
    return res.status(500).json({
      success: false,
      error: "Server error"
    });
  }
});

/* CREATE DECISION */
router.post("/", async (req, res) => {
  try {

    const { title, category, cost } = req.body;

    const decision = await prisma.decision.create({
      data: {
        title,
        category,
        cost
      }
    });

    return res.json({
      success: true,
      data: decision
    });

  } catch (error) {
    console.error("CREATE DECISION ERROR:", error);
    return res.status(500).json({
      success: false,
      error: "Server error"
    });
  }
});

/* CREATE EVALUATION (UPGRADED) */
router.post("/:id/evaluate", async (req, res) => {
  try {

    const decisionId = req.params.id;

    const {
      regretScore,
      frequencyOfUse,
      wouldBuyAgain,
      timePressure,
      emotionalWeight
    } = req.body;

    // basic validation (unchanged core)
    if (regretScore === undefined || !frequencyOfUse || wouldBuyAgain === undefined) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields"
      });
    }

    const evaluation = await prisma.evaluation.create({
      data: {
        decisionId,
        regretScore,
        frequencyOfUse,
        wouldBuyAgain,

        // NEW FIELDS (safe optional)
        timePressure: timePressure ?? null,
        emotionalWeight: emotionalWeight ?? null
      }
    });

    return res.json({
      success: true,
      data: evaluation
    });

  } catch (error) {
    console.error("CREATE EVALUATION ERROR:", error);
    return res.status(500).json({
      success: false,
      error: "Server error"
    });
  }
});

module.exports = router;