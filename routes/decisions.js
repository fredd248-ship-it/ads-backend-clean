const express = require("express");
const router = express.Router();
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

/* GET ALL DECISIONS */
router.get("/", async (req, res) => {
  try {

    const decisions = await prisma.decision.findMany({
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

module.exports = router;