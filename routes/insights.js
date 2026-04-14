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

/* 🔴 NEW — INSIGHT ENGINE */

function buildAdvancedInsights(decisions, scores) {

  let highTime = [], lowTime = [];
  let highEmotion = [], lowEmotion = [];
  let highUse = [], lowUse = [];

  decisions.forEach(d => {
    if (!d.evaluations.length) return;

    const latest = d.evaluations[d.evaluations.length - 1];
    const scoreObj = scores.find(s => s.id === d.id);
    if (!scoreObj) return;

    const score = scoreObj.displayScore;
    const freq = mapFrequency(latest.frequencyOfUse);

    /* TIME PRESSURE */
    if ((d.timePressure ?? 5) >= 7) highTime.push(score);
    if ((d.timePressure ?? 5) <= 4) lowTime.push(score);

    /* EMOTION */
    if ((d.emotionalWeight ?? 5) >= 7) highEmotion.push(score);
    if ((d.emotionalWeight ?? 5) <= 4) lowEmotion.push(score);

    /* USAGE */
    if (freq >= 0.7) highUse.push(score);
    if (freq <= 0.4) lowUse.push(score);
  });

  function avg(arr) {
    if (!arr.length) return null;
    return Math.round(arr.reduce((a, b) => a + b, 0) / arr.length);
  }

  const highTimeAvg = avg(highTime);
  const lowTimeAvg = avg(lowTime);

  const highEmotionAvg = avg(highEmotion);
  const lowEmotionAvg = avg(lowEmotion);

  const highUseAvg = avg(highUse);
  const lowUseAvg = avg(lowUse);

  return {

    timePressureInsight:
      highTimeAvg !== null && lowTimeAvg !== null
        ? `High-pressure decisions average ${highTimeAvg}/10 vs low-pressure decisions at ${lowTimeAvg}/10`
        : null,

    emotionalInsight:
      highEmotionAvg !== null && lowEmotionAvg !== null
        ? `High-emotion decisions average ${highEmotionAvg}/10 vs low-emotion decisions at ${lowEmotionAvg}/10`
        : null,

    usageInsight:
      highUseAvg !== null && lowUseAvg !== null
        ? `Frequently used decisions average ${highUseAvg}/10 vs rarely used decisions at ${lowUseAvg}/10`
        : null
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

    /* 🔴 NEW INSIGHTS */
    const advanced = buildAdvancedInsights(decisions, scores);

    return res.json({
      totalDecisions,
      evaluatedDecisions,
      evaluationRate,
      followThroughRate,
      averageRegretScore,

      timePressureInsight: advanced.timePressureInsight,
      emotionalInsight: advanced.emotionalInsight,
      usageInsight: advanced.usageInsight
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;