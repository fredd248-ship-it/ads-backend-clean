const express = require("express");
const router = express.Router();
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

/* GET ALL DECISIONS (USER SCOPED) */
router.get("/", async (req, res) => {
  try {

    const decisions = await prisma.decision.findMany({
      where: { userId: req.user.id }, // 🔴 CRITICAL FIX
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

/* CREATE DECISION (USER SCOPED) */
router.post("/", async (req, res) => {
  try {

    const {
      title,
      category,
      cost,
      timePressure,
      emotionalWeight
    } = req.body;

    const decision = await prisma.decision.create({
      data: {
        title,
        category,
        cost,
        timePressure: timePressure ?? null,
        emotionalWeight: emotionalWeight ?? null,

        userId: req.user.id // 🔴 CRITICAL FIX
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

/* CREATE EVALUATION (VALIDATE OWNERSHIP) */
router.post("/:id/evaluate", async (req, res) => {
  try {

    const decisionId = req.params.id;

    const decision = await prisma.decision.findUnique({
      where: { id: decisionId }
    });

    // 🔴 SECURITY CHECK
    if (!decision || decision.userId !== req.user.id) {
      return res.status(403).json({
        success: false,
        error: "Unauthorized"
      });
    }

    const {
      regretScore,
      frequencyOfUse,
      wouldBuyAgain,
      timePressure,
      emotionalWeight
    } = req.body;

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