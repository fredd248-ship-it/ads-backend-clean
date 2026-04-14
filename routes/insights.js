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

/* 🔴 NEW — RECENCY WEIGHT */
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

/* BEHAVIOR ENGINE (unchanged logic, now uses weighted scores) */

function buildBehaviorReport(scores, decisions) {
  if (!scores || scores.length < 5) return null;

  const categoryStats = {};

  decisions.forEach(d => {
    if (!d.evaluations.length) return;

    const latest = d.evaluations[d.evaluations.length - 1];
    const cat = (d.category || "other").toLowerCase();

    if (!categoryStats[cat]) {
      categoryStats[cat] = {
        scores: [],
        weights: [],
        frequency: [],
        buyAgain: []
      };
    }

    const scoreObj = scores.find(s => s.id === d.id);
    if (!scoreObj) return;

    categoryStats[cat].scores.push(scoreObj.displayScore);
    categoryStats[cat].weights.push(scoreObj.weight);
    categoryStats[cat].frequency.push(mapFrequency(latest.frequencyOfUse));
    categoryStats[cat].buyAgain.push(latest.wouldBuyAgain ? 1 : 0);
  });

  let strengthCandidates = [];
  const riskAreas = [];
  const recommendedAdjustments = [];
  const weakCategories = [];

  Object.keys(categoryStats).forEach(cat => {
    const data = categoryStats[cat];

    const weightedSum = data.scores.reduce((sum, s, i) => sum + s * data.weights[i], 0);
    const weightTotal = data.weights.reduce((a, b) => a + b, 0);

    const avgScore = weightedSum / weightTotal;
    const avgFreq = data.frequency.reduce((a, b) => a + b, 0) / data.frequency.length;
    const buyRate = data.buyAgain.reduce((a, b) => a + b, 0) / data.buyAgain.length;

    if (avgScore >= 7) {
      strengthCandidates.push({ cat, avg: avgScore });
    }

    if (avgScore <= 4) {
      weakCategories.push({ cat, avgScore, avgFreq, buyRate });

      let reason = [];
      if (avgFreq < 0.5) reason.push("low reuse");
      if (buyRate < 0.5) reason.push("low buy-again rate");

      const reasonText = reason.length ? ` driven by ${reason.join(" and ")}` : "";

      riskAreas.push(
        `${cat} decisions show low satisfaction (avg ${Math.round(avgScore)}/10)${reasonText}`
      );

      let actions = [];
      if (avgFreq < 0.5) actions.push("test or trial options");
      if (buyRate < 0.5) actions.push("compare alternatives");
      if (actions.length === 0) actions.push("slow down and review before committing");

      recommendedAdjustments.push(
        `Before making ${cat} decisions: ${actions.join(" and ")}`
      );
    }
  });

  const strengths =
    strengthCandidates
      .sort((a, b) => b.avg - a.avg)
      .slice(0, 3)
      .map(s => `Strong performance in ${s.cat} (avg ${Math.round(s.avg)}/10)`);

  if (strengths.length === 0) strengths.push("Balanced performance across categories");
  if (riskAreas.length === 0) riskAreas.push("No significant risk patterns detected");
  if (recommendedAdjustments.length === 0) {
    recommendedAdjustments.push("Maintain your current decision-making approach");
  }

  const weightedSum =
    scores.reduce((sum, s) => sum + s.displayScore * s.weight, 0);
  const weightTotal =
    scores.reduce((sum, s) => sum + s.weight, 0);

  const avgOverall = weightedSum / weightTotal;

  let currentBlindSpot = "No major blind spots detected";

  if (weakCategories.length > 0) {
    const topWeak = weakCategories.slice(0, 2);
    const cats = topWeak.map(c => c.cat).join(" and ");

    let causes = [];
    const avgFreq = topWeak.reduce((a, b) => a + b.avgFreq, 0) / topWeak.length;
    const avgBuy = topWeak.reduce((a, b) => a + b.buyRate, 0) / topWeak.length;

    if (avgFreq < 0.5) causes.push("low reuse");
    if (avgBuy < 0.5) causes.push("low buy-again outcomes");

    const causeText = causes.length ? `, driven by ${causes.join(" and ")}` : "";

    currentBlindSpot = `You consistently underperform in ${cats} decisions${causeText}`;
  }

  return {
    decisionProfile:
      avgOverall >= 6
        ? "You generally make stable, reliable decisions"
        : "Your decision-making shows inconsistency and opportunity for improvement",

    coachingSummary:
      avgOverall >= 6
        ? "Your results are consistently strong with some variation across categories"
        : "Your results suggest inconsistent decision quality across categories",

    currentBlindSpot,

    bestNextHabit:
      avgOverall >= 6
        ? "Apply the same decision process you use in your strongest categories to improve weaker ones"
        : "Pause before committing and compare at least one alternative for each decision",

    strengths,
    riskAreas,
    recommendedAdjustments
  };
}

/* ROUTE */

router.get("/", async (req, res) => {
  try {

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

        const weight = getRecencyWeight(d.createdAt);

        scores.push({
          id: d.id,
          title: d.title,
          category: (d.category || "other").toLowerCase(),
          displayScore,
          weight
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

    const weightedSum =
      scores.reduce((sum, s) => sum + s.displayScore * s.weight, 0);

    const weightTotal =
      scores.reduce((sum, s) => sum + s.weight, 0);

    const averageRegretScore =
      scores.length > 0
        ? Math.round(weightedSum / weightTotal)
        : 0;

    const behaviorReport = buildBehaviorReport(scores, decisions);

    return res.json({
      totalDecisions,
      evaluatedDecisions,
      evaluationRate,
      followThroughRate,
      averageRegretScore,
      scores,
      behaviorReport
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;