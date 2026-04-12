const express = require("express");
const router = express.Router();
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

/* HELPERS */

function mapFrequency(freq) {
  if (!freq) return 0;
  const f = freq.toLowerCase();
  if (f.includes("day")) return 1.0;
  if (f.includes("week")) return 0.7;
  if (f.includes("month")) return 0.4;
  return 0.1;
}

function computeQualityScore(evaluation, decision) {
  const regretNorm = 1 - (evaluation.regretScore / 10);
  const frequencyNorm = mapFrequency(evaluation.frequencyOfUse);
  const buyAgainNorm = evaluation.wouldBuyAgain ? 1 : 0;

  const timeNorm = (decision.timePressure ?? 5) / 10;
  const emotionNorm = (decision.emotionalWeight ?? 5) / 10;

  const score =
    (regretNorm * 0.35) +
    (frequencyNorm * 0.20) +
    (buyAgainNorm * 0.20) +
    ((1 - timeNorm) * 0.15) +
    ((1 - emotionNorm) * 0.10);

  return Math.round(score * 100);
}

/* NEW: EXPLANATION ENGINE */
function generateExplanation(evaluation, decision) {
  const messages = [];

  if (decision.emotionalWeight >= 7) {
    messages.push("High emotional influence may have impacted this decision");
  }

  if (decision.timePressure >= 7) {
    messages.push("This decision was made under time pressure");
  }

  if (evaluation.wouldBuyAgain === false) {
    messages.push("You would not make this decision again");
  }

  const freq = mapFrequency(evaluation.frequencyOfUse);

  if (freq >= 0.7) {
    messages.push("This decision is used frequently and provides value");
  } else if (freq <= 0.2) {
    messages.push("This decision sees little use");
  }

  if (messages.length === 0) {
    messages.push("This appears to be a stable, balanced decision");
  }

  return messages;
}

/* INSIGHTS ROUTE */
router.get("/", async (req, res) => {
  try {

    const decisions = await prisma.decision.findMany({
      include: { evaluations: true }
    });

    let totalDecisions = decisions.length;
    let evaluatedDecisions = 0;

    let scores = [];

    decisions.forEach(d => {
      if (d.evaluations && d.evaluations.length > 0) {

        evaluatedDecisions++;

        const latestEval = d.evaluations[d.evaluations.length - 1];

        const rawScore = computeQualityScore(latestEval, d);
        const displayScore = Math.round(rawScore / 10);

        const explanation = generateExplanation(latestEval, d);

        scores.push({
          id: d.id,
          title: d.title,
          category: d.category,
          qualityScore: rawScore,
          displayScore,
          explanation
        });
      }
    });

    const averageScore =
      scores.length > 0
        ? Math.round(scores.reduce((a, b) => a + b.displayScore, 0) / scores.length)
        : 0;

    const bestDecision = scores.sort((a, b) => b.displayScore - a.displayScore)[0] || null;
    const worstDecision = scores.sort((a, b) => a.displayScore - b.displayScore)[0] || null;

    return res.json({
      totalDecisions,
      evaluatedDecisions,
      averageScore,
      bestDecision,
      worstDecision,
      scores
    });

  } catch (error) {
    console.error("INSIGHTS ERROR:", error);
    return res.status(500).json({
      error: "Server error"
    });
  }
});

module.exports = router;