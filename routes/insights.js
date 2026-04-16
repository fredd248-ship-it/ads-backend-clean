const express = require("express");
const router = express.Router();
const { PrismaClient } = require("@prisma/client");

/* 🔴 FIX: STABLE PRISMA */
let prisma;
if (!global.prisma) {
  global.prisma = new PrismaClient();
}
prisma = global.prisma;

/* 🔴 SAFETY: TIMEOUT */
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

/* 🔴 MATURITY (UNCHANGED) */
function getInsightMaturity(evaluated) {
  if (evaluated < 3) return "none";
  if (evaluated < 8) return "early";
  if (evaluated < 20) return "developing";
  if (evaluated < 50) return "stable";
  return "advanced";
}

/* ROUTE */

router.get("/", async (req, res) => {
  try {

    /* 🔴 CRITICAL GUARD */
    if (!req.user || !req.user.id) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    /* 🔴 SAFE QUERY */
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

    const insightMaturity = getInsightMaturity(evaluatedDecisions);

    return res.json({
      totalDecisions,
      evaluatedDecisions,
      evaluationRate,
      followThroughRate,
      averageRegretScore,
      insightMaturity
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