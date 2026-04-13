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

  const time = (decision.timePressure ?? 5) / 10;
  const emotion = (decision.emotionalWeight ?? 5) / 10;

  const score =
    (regretNorm * 0.35) +
    (frequencyNorm * 0.20) +
    (buyAgainNorm * 0.20) +
    ((1 - time * time) * 0.15) +
    ((1 - emotion * emotion) * 0.10);

  return Math.round(score * 100);
}

/* BEHAVIOR ENGINE */

function buildBehaviorReport(scores) {
  if (!scores || scores.length < 5) return null;

  let low = 0;
  let high = 0;

  scores.forEach(s => {
    if (s.displayScore <= 4) low++;
    if (s.displayScore >= 7) high++;
  });

  return {
    decisionProfile:
      low > high
        ? "You tend to make inconsistent or lower-quality decisions"
        : "You generally make stable, reliable decisions",
    coachingSummary:
      low > high
        ? "Your results suggest inconsistency"
        : "Your results show consistency",
    currentBlindSpot:
      low > high
        ? "Inconsistent decision quality"
        : "No major blind spots detected",
    bestNextHabit:
      low > high
        ? "Introduce a more structured decision process"
        : "Continue your current approach",
    strengths: [],
    riskAreas: [],
    recommendedAdjustments: []
  };
}

/* ROUTE */

router.get("/", async (req, res) => {
  try {

    // 🔴 CRITICAL FIX — USER SCOPING
    const decisions = await prisma.decision.findMany({
      where: { userId: req.user.id },
      include: { evaluations: true }
    });

    let scores = [];
    let totalEvaluations = 0;
    let wouldBuyAgainCount = 0;

    decisions.forEach(d => {

      d.evaluations.forEach(e => {
        totalEvaluations++;
        if (e.wouldBuyAgain) wouldBuyAgainCount++;
      });

      if (d.evaluations.length > 0) {
        const latest = d.evaluations[d.evaluations.length - 1];

        const raw = computeQualityScore(latest, d);
        const displayScore = Math.round(raw / 10);

        scores.push({
          id: d.id,
          title: d.title,
          category: (d.category || "other").toLowerCase(),
          displayScore
        });
      }
    });

    const totalDecisions = decisions.length;
    const evaluatedDecisions = scores.length;

    const evaluationRate =
      totalDecisions > 0
        ? Math.round((evaluatedDecisions / totalDecisions) * 100)
        : 0;

    const followThroughRate =
      totalEvaluations > 0
        ? Math.round((wouldBuyAgainCount / totalEvaluations) * 100)
        : 0;

    /* 🔥 CATEGORY INTELLIGENCE */

    const categoryMap = {};

    scores.forEach(s => {
      if (!categoryMap[s.category]) {
        categoryMap[s.category] = [];
      }
      categoryMap[s.category].push(s.displayScore);
    });

    let bestCategory = null;
    let worstCategory = null;
    let bestAvg = -1;
    let worstAvg = 11;

    Object.keys(categoryMap).forEach(cat => {
      const arr = categoryMap[cat];
      const avg = arr.reduce((a, b) => a + b, 0) / arr.length;

      if (avg > bestAvg) {
        bestAvg = avg;
        bestCategory = cat;
      }

      if (avg < worstAvg) {
        worstAvg = avg;
        worstCategory = cat;
      }
    });

    /* 🎯 INSIGHT GENERATION */

    let primaryPattern = "Not enough data";
    let stability = "Not enough data";
    let recommendedFocus = "Continue evaluating decisions";

    if (scores.length >= 5) {

      if (bestCategory && worstCategory && bestCategory !== worstCategory) {
        primaryPattern =
          `You perform strongly in ${bestCategory} decisions but less effectively in ${worstCategory}`;
      }

      const diff = bestAvg - worstAvg;

      if (diff < 1.5) {
        stability = "Your decision-making is consistent across categories";
      } else {
        stability = "Your decision quality varies significantly by category";
      }

      if (worstCategory) {
        recommendedFocus =
          `Focus on improving decisions in ${worstCategory}`;
      }
    }

    const behaviorReport = buildBehaviorReport(scores);

    return res.json({
      totalDecisions,
      evaluatedDecisions,
      evaluationRate,
      followThroughRate,

      primaryPattern,
      stability,
      recommendedFocus,

      scores,
      behaviorReport
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;