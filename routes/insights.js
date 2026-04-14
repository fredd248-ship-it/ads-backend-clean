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

/* 🔴 PHASE 2.5 — REFINED BEHAVIOR ENGINE */

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
        frequency: [],
        buyAgain: []
      };
    }

    const displayScore = scores.find(s => s.id === d.id)?.displayScore;
    if (displayScore == null) return;

    categoryStats[cat].scores.push(displayScore);
    categoryStats[cat].frequency.push(mapFrequency(latest.frequencyOfUse));
    categoryStats[cat].buyAgain.push(latest.wouldBuyAgain ? 1 : 0);
  });

  let strengthCandidates = [];
  const riskAreas = [];
  const recommendedAdjustments = [];

  Object.keys(categoryStats).forEach(cat => {
    const data = categoryStats[cat];

    const avgScore = data.scores.reduce((a, b) => a + b, 0) / data.scores.length;
    const avgFreq = data.frequency.reduce((a, b) => a + b, 0) / data.frequency.length;
    const buyRate = data.buyAgain.reduce((a, b) => a + b, 0) / data.buyAgain.length;

    // Collect strength candidates (we'll rank later)
    if (avgScore >= 7) {
      strengthCandidates.push({
        cat,
        avg: avgScore
      });
    }

    if (avgScore <= 4) {
      let reason = [];

      if (avgFreq < 0.5) reason.push("low reuse");
      if (buyRate < 0.5) reason.push("low buy-again rate");

      const reasonText = reason.length ? ` driven by ${reason.join(" and ")}` : "";

      riskAreas.push(
        `${cat} decisions show low satisfaction (avg ${Math.round(avgScore)}/10)${reasonText}`
      );

      // 🔴 CONSOLIDATED RECOMMENDATION
      let actions = [];

      if (avgFreq < 0.5) actions.push("test or trial options");
      if (buyRate < 0.5) actions.push("compare at least two alternatives");

      if (actions.length === 0) {
        actions.push("slow down and review before committing");
      }

      recommendedAdjustments.push(
        `Before making ${cat} decisions: ${actions.join(" and ")}`
      );
    }
  });

  // 🔴 LIMIT TO TOP 3 STRENGTHS
  const strengths =
    strengthCandidates
      .sort((a, b) => b.avg - a.avg)
      .slice(0, 3)
      .map(s => `Strong performance in ${s.cat} (avg ${Math.round(s.avg)}/10)`);

  // Ensure non-empty outputs
  if (strengths.length === 0) {
    strengths.push("Balanced performance across categories");
  }

  if (riskAreas.length === 0) {
    riskAreas.push("No significant risk patterns detected");
  }

  if (recommendedAdjustments.length === 0) {
    recommendedAdjustments.push("Maintain your current decision-making approach");
  }

  const avgOverall =
    scores.reduce((sum, s) => sum + s.displayScore, 0) / scores.length;

  return {
    decisionProfile:
      avgOverall >= 6
        ? "You generally make stable, reliable decisions"
        : "Your decision-making shows inconsistency and opportunity for improvement",
    coachingSummary:
      avgOverall >= 6
        ? "Your results show consistency with occasional variation"
        : "Your results suggest inconsistent decision quality",
    currentBlindSpot:
      riskAreas.length > 0 &&
      !riskAreas.includes("No significant risk patterns detected")
        ? "Specific categories consistently underperform"
        : "No major blind spots detected",
    bestNextHabit:
      avgOverall >= 6
        ? "Reinforce your strongest decision patterns"
        : "Introduce a structured evaluation step before decisions",
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

    const averageRegretScore =
      scores.length > 0
        ? Math.round(
            scores.reduce((sum, s) => sum + s.displayScore, 0) / scores.length
          )
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