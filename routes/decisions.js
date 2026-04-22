const express = require('express');
const router = express.Router();
const prisma = require('../prisma');
const authenticate = require('../middleware/authenticate');

/* =========================
   GET ALL DECISIONS
========================= */
router.get('/', authenticate, async (req, res) => {
  try {
    const decisions = await prisma.decision.findMany({
      where: { userId: req.user.id },
      include: { evaluations: true },
      orderBy: { createdAt: 'desc' }
    });

    res.json({ success: true, data: decisions });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch decisions' });
  }
});

/* =========================
   CREATE DECISION
========================= */
router.post('/', authenticate, async (req, res) => {
  try {
    const { title, category, cost } = req.body;

    const decision = await prisma.decision.create({
      data: {
        title,
        category,
        cost,
        userId: req.user.id
      }
    });

    res.json({ success: true, data: decision });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to create decision' });
  }
});

/* =========================
   EVALUATE DECISION (CRITICAL FIX)
========================= */
router.post('/:id/evaluate', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { regretScore, frequencyOfUse, wouldBuyAgain } = req.body;

    const evaluation = await prisma.evaluation.create({
      data: {
        decisionId: id,
        regretScore,
        frequencyOfUse,
        wouldBuyAgain
      }
    });

    res.json({ success: true, data: evaluation });
  } catch (err) {
    console.error("EVALUATION ERROR:", err);
    res.status(500).json({ success: false, error: 'Failed to save evaluation' });
  }
});

module.exports = router;