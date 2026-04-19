// (FULL FILE — COMPLETE REPLACEMENT)

const express = require("express");
const router = express.Router();
const { PrismaClient } = require("@prisma/client");

/* 🔴 STABLE PRISMA */
let prisma;
if (!global.prisma) {
  global.prisma = new PrismaClient();
}
prisma = global.prisma;

/* 🔴 TIMEOUT */
async function withTimeout(promise, ms = 8000) {
  const timeout = new Promise((_, reject) =>
    setTimeout(() => reject(new Error("DB_TIMEOUT")), ms)
  );
  return Promise.race([promise, timeout]);
}

/* HELPERS */

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

/* 🔴 TEMPORAL DISTRIBUTION (NOW PRIMARY) */

function buildDistribution(scores) {
  if (!scores.length) return null;

  let strong = 0, average = 0, weak = 0;
  let totalWeight = 0;

  scores.forEach(s => {
    totalWeight += s.weight;

    if (s.displayScore >= 8) strong += s.weight;
    else if (s.displayScore >= 5) average += s.weight;
    else weak += s.weight;
  });

  return {
    strong: Math.round((strong / totalWeight) * 100),
    average: Math.round((average / totalWeight) * 100),
    weak: Math.round((weak / totalWeight) * 100)
  };
}

/* 🔴 CATEGORY ENGINE (NOW TEMPORAL) */

function buildCategoryInsights(decisions, scores) {
  const map = {};
  const counts = {};

  decisions.forEach(d => {
    const cat = d.category || "other";
    counts[cat] = (counts[cat] || 0) + 1;

    if (!d.evaluations.length) return;

    const scoreObj = scores.find(s => s.id === d.id);
    if (!scoreObj) return;

    if (!map[cat]) map[cat] = { weightedSum: 0, weight: 0 };

    map[cat].weightedSum += scoreObj.displayScore * scoreObj.weight;
    map[cat].weight += scoreObj.weight;
  });

  let mostUsedCategory = null;
  let maxCount = 0;

  Object.entries(counts).forEach(([cat, count]) => {
    if (count > maxCount) {
      maxCount = count;
      mostUsedCategory = cat;
    }
  });

  let bestCategory = null, worstCategory = null;
  let bestAvg = -Infinity, worstAvg = Infinity;

  Object.entries(map).forEach(([cat, obj]) => {
    const avg = obj.weight > 0 ? obj.weightedSum / obj.weight : 0;

    if (avg > bestAvg) { bestAvg = avg; bestCategory = cat; }
    if (avg < worstAvg) { worstAvg = avg; worstCategory = cat; }
  });

  return {
    mostUsedCategory,
    bestCategory,
    worstCategory,
    bestAvg: Math.round(bestAvg),
    worstAvg: Math.round(worstAvg)
  };
}

/* 🔴 COACHING ENGINE (UNCHANGED FOR SAFETY) */

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

  return {
    decisionProfile: "Your decision-making shows clear patterns across different categories",
    coachingSummary: "Your results reflect evolving patterns shaped more by your recent decisions.",
    currentBlindSpot: weakCats.join(", ") || "No clear blind spots detected",
    bestNextHabit: "Be more deliberate in categories where recent outcomes are weaker",
    strengths: strongCats,
    recommendedAdjustments: weakCats.length > 0
      ? ["Slow down before committing", "Compare multiple options"]
      : []
  };
}

function buildStrategicInsights(categoryData, scores) {
  let primaryPattern = null, stability = null, recommendedFocus = null;

  if (categoryData.bestCategory && categoryData.worstCategory) {
    primaryPattern = `You perform strongly in ${categoryData.bestCategory} decisions but less effectively in ${categoryData.worstCategory}`;
    recommendedFocus = `Focus on improving decisions in ${categoryData.worstCategory}`;
  }

  if (scores.length > 1) {
    const vals = scores.map(s => s.displayScore);
    const avg = vals.reduce((a, b) => a + b, 0) / vals.length;

    const variance = vals.reduce((sum, v) => sum + Math.pow(v - avg, 2), 0) / vals.length;

    stability =
      variance > 4
        ? "Your decision quality varies significantly by category"
        : "Your decision-making is relatively consistent";
  }

  return { primaryPattern, stability, recommendedFocus };
}

/* ROUTE */

router.get("/", async (req, res) => {
  try {

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
      distribution,
      mostUsedCategory: categoryData.mostUsedCategory,
      bestCategory: categoryData.bestCategory,
      worstCategory: categoryData.worstCategory
    });

  } catch (err) {
    console.error("INSIGHTS ERROR:", err);

    if (err.message === "DB_TIMEOUT") {
      return res.status(503).json({ error: "Database timeout" });
    }

    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;