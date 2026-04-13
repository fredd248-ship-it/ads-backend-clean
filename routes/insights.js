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

/* BEHAVIOR ENGINE */

function buildBehaviorReport(scores, decisions) {

  if (!scores || scores.length < 5) return null;

  let highEmotion = 0;
  let highTime = 0;
  let lowScore = 0;
  let strongScore = 0;

  decisions.forEach(d => {
    if ((d.emotionalWeight ?? 0) >= 7) highEmotion++;
    if ((d.timePressure ?? 0) >= 7) highTime++;
  });

  scores.forEach(s => {
    if (s.displayScore <= 4) lowScore++;
    if (s.displayScore >= 7) strongScore++;
  });

  const decisionProfile =
    lowScore > strongScore
      ? "You tend to make inconsistent or lower-quality decisions"
      : "You generally make stable, reliable decisions";

  const coachingSummary =
    highEmotion > highTime
      ? "Emotions influence your decisions more than timing"
      : "Time pressure influences your decisions more than emotion";

  const currentBlindSpot =
    highEmotion > scores.length / 2
      ? "You may underestimate emotional influence"
      : highTime > scores.length / 2
      ? "You may rush decisions under time pressure"
      : "No major blind spots detected";

  const bestNextHabit =
    lowScore > strongScore
      ? "Slow down and evaluate decisions more deliberately"
      : "Continue your current approach";

  const strengths = [];
  const riskAreas = [];
  const recommendedAdjustments = [];

  if (strongScore > lowScore) {
    strengths.push("You frequently make high-quality decisions");
  }

  if (highEmotion < scores.length / 2) {
    strengths.push("You are not overly driven by emotion");
  }

  if (lowScore > strongScore) {
    riskAreas.push("Inconsistent decision outcomes");
    recommendedAdjustments.push("Introduce a structured decision process");
  }

  if (highTime > scores.length / 2) {
    riskAreas.push("Frequent time pressure decisions");
    recommendedAdjustments.push("Allow more time before committing");
  }

  if (highEmotion > scores.length / 2) {
    riskAreas.push("Emotion-driven decisions");
    recommendedAdjustments.push("Pause before emotional decisions");
  }

  return {
    decisionProfile,
    coachingSummary,
    currentBlindSpot,
    bestNextHabit,
    strengths,
    riskAreas,
    recommendedAdjustments
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

    const followThroughRate =
      totalEvaluations > 0
        ? Math.round((wouldBuyAgainCount / totalEvaluations) * 100)
        : 0;

    const averageScore =
      scores.length > 0
        ? Math.round(scores.reduce((a, b) => a + b.displayScore, 0) / scores.length)
        : 0;

    const sortedHigh = [...scores].sort((a, b) => b.displayScore - a.displayScore);
    const sortedLow = [...scores].sort((a, b) => a.displayScore - b.displayScore);

    const bestDecision = sortedHigh[0] || null;
    const worstDecision = sortedLow[0] || null;

    const behaviorReport = buildBehaviorReport(scores, decisions);

    return res.json({
      totalDecisions,
      evaluatedDecisions,
      followThroughRate,
      averageScore,
      bestDecision,
      worstDecision,
      scores,
      behaviorReport
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;