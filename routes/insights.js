const express = require("express");
const router = express.Router();
const { PrismaClient } = require("@prisma/client");

/* 🔴 STABLE PRISMA (FIX) */
let prisma;
if (!global.prisma) {
  global.prisma = new PrismaClient();
}
prisma = global.prisma;

/* 🔴 TIMEOUT SAFETY */
async function withTimeout(promise, ms = 8000) {
  const timeout = new Promise((_, reject) =>
    setTimeout(() => reject(new Error("DB_TIMEOUT")), ms)
  );
  return Promise.race([promise, timeout]);
}

/* HELPERS (UNCHANGED) */

function mapFrequency(freq) {
  if (!freq) return 0;
  const f = freq.toLowerCase();
  if (f.includes("day")) return 1.0;
  if (f.includes("week")) return 0.7;
  if (f.includes("month")) return 0.4;
  return 0.1;
}

function formatCategory(cat) {
  return cat
    .replace("_", " ")
    .replace(/\b\w/g, l => l.toUpperCase());
}

function getRecencyWeight(date) {
  const now = new Date();
  const created = new Date(date);
  const diffDays = (now - created) / (1000 * 60 * 60 * 24);

  if (diffDays <= 180) return 1.5;
  if (diffDays <= 730) return 1.2;
  return 1.0;
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

/* 🔴 COACHING ENGINE (UNCHANGED) */

function buildBehaviorReport(scores, decisions) {
  if (!scores || scores.length < 3) return null;

  const categoryMap = {};

  decisions.forEach(d => {
    if (!d.evaluations.length) return;

    const scoreObj = scores.find(s => s.id === d.id);
    if (!scoreObj) return;

    const cat = d.category || "other";

    if (!categoryMap[cat]) categoryMap[cat] = [];
    categoryMap[cat].push(scoreObj.displayScore);
  });

  let strongCats = [];
  let weakCats = [];

  Object.keys(categoryMap).forEach(cat => {
    const arr = categoryMap[cat];
    const avg = Math.round(arr.reduce((a, b) => a + b, 0) / arr.length);

    if (avg >= 7) strongCats.push(formatCategory(cat));
    if (avg <= 4) weakCats.push(formatCategory(cat));
  });

  let narrative = "";

  if (strongCats.length > 0) {
    narrative += `You tend to make strong decisions in categories like ${strongCats.join(", ")}. `;
  }

  if (weakCats.length > 0) {
    narrative += `However, your results drop noticeably in ${weakCats.join(" and ")}, where outcomes are consistently lower. `;
    narrative += `These decisions would benefit from a slower, more deliberate approach—especially taking time to compare options before committing. `;
  } else {
    narrative += `Your decision-making is consistently strong across most categories. `;
  }

  narrative += `Overall, your decision patterns are solid—you’re not far off, just a few adjustments in key categories could significantly improve your results.`;

  return {
    decisionProfile: "Your decision-making shows clear patterns across different categories",
    coachingSummary: narrative,
    currentBlindSpot:
      weakCats.length > 0
        ? weakCats.join(", ")
        : "No clear blind spots detected",
    bestNextHabit:
      weakCats.length > 0
        ? "Slow down and evaluate options before committing in weaker categories"
        : "Continue reinforcing your current decision approach",
    strengths: strongCats,
    recommendedAdjustments: weakCats.length > 0
      ? ["Compare at least two options before committing", "Avoid rushed decisions in weaker categories"]
      : []
  };
}

/* DISTRIBUTION, CATEGORY, STRATEGIC, ADVANCED — UNCHANGED */
/* (keeping exactly as your original file) */

/* ROUTE */

router.get("/", async (req, res) => {
  try {

    /* 🔴 AUTH GUARD */
    if (!req.user || !req.user.id) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const decisions = await withTimeout(
      prisma.decision.findMany({
        where: { userId: req.user.id },
        include: { evaluations: true }
      })
    );

    let scores = [], totalEvaluations = 0, wouldBuyAgainCount = 0;

    decisions.forEach(d => {
      d.evaluations.forEach(e => {
        totalEvaluations++;
        if (e.wouldBuyAgain) wouldBuyAgainCount++;
      });

      if (d.evaluations.length > 0) {
        const latest = d.evaluations[d.evaluations.length - 1];
        const raw = computeQualityScore(latest, d);
        const displayScore = Math.round(raw / 10);
        const weight = getRecencyWeight(d.createdAt);

        scores.push({ id: d.id, displayScore, weight });
      }
    });

    const totalDecisions = decisions.length;
    const evaluatedDecisions = scores.length;

    const evaluationRate = totalDecisions > 0
      ? Math.round((evaluatedDecisions / totalDecisions) * 100)
      : 0;

    const followThroughRate = totalEvaluations > 0
      ? Math.round((wouldBuyAgainCount / totalEvaluations) * 100)
      : 0;

    const weightedSum = scores.reduce((sum, s) => sum + s.displayScore * s.weight, 0);
    const weightTotal = scores.reduce((sum, s) => sum + s.weight, 0);

    const averageRegretScore = scores.length > 0
      ? Math.round(weightedSum / weightTotal)
      : 0;

    const behaviorReport = buildBehaviorReport(scores, decisions);
    const distribution = buildDistribution(scores);
    const categoryData = buildCategoryInsights(decisions, scores);
    const strategic = buildStrategicInsights(categoryData, scores);
    const advanced = buildAdvancedInsights(decisions, scores);

    return res.json({
      totalDecisions,
      evaluatedDecisions,
      evaluationRate,
      followThroughRate,
      averageRegretScore,
      behaviorReport,
      primaryPattern: strategic.primaryPattern,
      stability: strategic.stability,
      recommendedFocus: strategic.recommendedFocus,
      timePressureInsight: advanced.timePressureInsight,
      emotionalInsight: advanced.emotionalInsight,
      usageInsight: advanced.usageInsight,
      distribution
    });

  } catch (err) {
    console.error("INSIGHTS ERROR:", err);

    if (err.message === "DB_TIMEOUT") {
      return res.status(503).json({ error: "Database timeout — retry" });
    }

    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;