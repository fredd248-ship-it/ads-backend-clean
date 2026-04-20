const express = require("express");
const router = express.Router();
const authenticate = require("../middleware/authenticate");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

/* =========================
   GET DECISIONS
========================= */
router.get("/", authenticate, async (req, res) => {
  try {

    const decisions = await prisma.decision.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: "desc" },
      include: {
        evaluations: true
      }
    });

    return res.json({
      success: true,
      data: decisions
    });

  } catch (err) {
    console.error("DECISIONS ERROR:", err);

    return res.status(500).json({
      success: false,
      error: "Failed to load decisions"
    });
  }
});

/* =========================
   CREATE DECISION
========================= */
router.post("/", authenticate, async (req, res) => {
  try {

    const { title, cost, category, timePressure, emotionalWeight } = req.body;

    const decision = await prisma.decision.create({
      data: {
        title,
        cost: cost || 0,
        category,
        timePressure,
        emotionalWeight,
        userId: req.user.id
      }
    });

    return res.json({
      success: true,
      data: decision
    });

  } catch (err) {
    console.error("CREATE ERROR:", err);

    return res.status(500).json({
      success: false,
      error: "Failed to create decision"
    });
  }
});

module.exports = router;