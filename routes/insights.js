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

  const timePenalty = Math.pow(time, 2);
  const emotionPenalty = Math.pow(emotion, 2);

  const score =
    (regretNorm * 0.35) +
    (frequencyNorm * 0.20) +
    (buyAgainNorm * 0.20) +
    ((1 - timePenalty) * 0.15) +
    ((1 - emotionPenalty) * 0.10);

  return Math.round(score * 100);
}

/* BEHAVIOR ENGINE (UNCHANGED) */

function buildBehaviorReport(scores, decisions) {
  if (!scores || scores.length < 5) return null;

  let lowScore = 0;
  let strongScore = 0;

  scores.forEach(s => {
    if (s.displayScore <= 4) lowScore++;
    if (s.displayScore >= 7) strongScore++;
  });

  const decisionProfile =
    lowScore > strongScore
      ? "You tend to make inconsistent or lower-quality decisions"
      : "You generally make stable, reliable decisions";

  const coachingSummary =
    lowScore > strongScore
      ? "Your results suggest inconsistency"
      : "Your results show consistency";

  const currentBlindSpot =
    lowScore > strongScore
      ? "Inconsistent decision quality"
      : "No major blind spots detected";

  const bestNextHabit =
    lowScore > strongScore
      ? "Introduce a more structured decision process"
      : "Continue your current approach";

  return {
    decisionProfile,
    coachingSummary,
    currentBlindSpot,
    bestNextHabit,
    strengths: [],
    riskAreas: [],
    recommendedAdjustments: []
  };
}

/* ROUTE */

router.get("/", async (req, res) => {
  try {

    const decisions = await prisma.decision.findMany({
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

        const rawScore = computeQualityScore(latest, d);
        const displayScore = Math.round(rawScore / 10);

        scores.push({
          id: d.id,
          title: d.title,
          category: d.category,
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

    /* 🔥 RESTORED LOGIC */

    const avg =
      scores.length > 0
        ? scores.reduce((a, b) => a + b.displayScore, 0) / scores.length
        : 0;

    const variance =
      scores.length > 0
        ? scores.reduce((a, b) => a + Math.pow(b.displayScore - avg, 2), 0) / scores.length
        : 0;

    let primaryPattern = "";
    let stability = "";
    let recommendedFocus = "";

    if (avg >= 7) {
      primaryPattern = "You consistently make strong decisions";
    } else if (avg >= 5) {
      primaryPattern = "Your decisions are moderately effective";
    } else {
      primaryPattern = "Your decisions need improvement";
    }

    if (variance < 2) {
      stability = "Your decision-making is consistent";
    } else {
      stability = "Your decision outcomes are inconsistent";
    }

    if (avg < 6) {
      recommendedFocus = "Improve evaluation and reflection";
    } else if (variance > 3) {
      recommendedFocus = "Reduce inconsistency in decisions";
    } else {
      recommendedFocus = "Maintain your current approach";
    }

    const behaviorReport = buildBehaviorReport(scores, decisions);

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