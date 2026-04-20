const express = require("express");
const router = express.Router();
const authenticate = require("../middleware/authenticate");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

router.get("/", authenticate, async (req, res) => {
  try {

    const decisions = await prisma.decision.findMany({
      where: { userId: req.user.id },
      include: { evaluations: true }
    });

    const totalDecisions = decisions.length;

    let evaluatedDecisions = 0;
    let totalScore = 0;
    let scoreCount = 0;

    let strong = 0;
    let average = 0;
    let weak = 0;

    let wouldDo = 0;
    let totalEvaluations = 0;

    const categoryScores = {};
    const categoryCounts = {};

    let highPressureBad = 0;
    let emotionalBad = 0;

    // 🧠 NEW — COST INTELLIGENCE
    let expensiveMistakes = 0;
    let expensiveWins = 0;
    let totalSpend = 0;

    decisions.forEach(d => {

      if (d.cost) {
        totalSpend += d.cost;
      }

      if (!d.evaluations || d.evaluations.length === 0) return;

      evaluatedDecisions++;

      d.evaluations.forEach(e => {

        const score = 10 - e.regretScore;

        totalScore += score;
        scoreCount++;
        totalEvaluations++;

        // distribution
        if (score >= 7) strong++;
        else if (score >= 4) average++;
        else weak++;

        // follow-through
        if (e.wouldBuyAgain) wouldDo++;

        // category tracking
        if (d.category) {
          categoryScores[d.category] = (categoryScores[d.category] || 0) + score;
          categoryCounts[d.category] = (categoryCounts[d.category] || 0) + 1;
        }

        // behavior signals
        if (d.timePressure >= 4 && score < 6) highPressureBad++;
        if (d.emotionalWeight >= 4 && score < 6) emotionalBad++;

        // 🧠 COST PATTERNS
        if (d.cost && d.cost >= 500 && score <= 4) {
          expensiveMistakes++;
        }

        if (d.cost && d.cost >= 500 && score >= 8) {
          expensiveWins++;
        }

      });

    });

    const avgScore = scoreCount ? totalScore / scoreCount : 0;

    const distribution = totalEvaluations ? {
      strong: Math.round((strong / totalEvaluations) * 100),
      average: Math.round((average / totalEvaluations) * 100),
      weak: Math.round((weak / totalEvaluations) * 100)
    } : null;

    const evaluationRate = totalDecisions
      ? Math.round((evaluatedDecisions / totalDecisions) * 100)
      : 0;

    const followThroughRate = totalEvaluations
      ? Math.round((wouldDo / totalEvaluations) * 100)
      : 0;

    // CATEGORY PERFORMANCE
    const categoryAverages = Object.keys(categoryScores).map(cat => ({
      category: cat,
      avg: categoryScores[cat] / categoryCounts[cat]
    }));

    categoryAverages.sort((a, b) => b.avg - a.avg);

    const strengths = categoryAverages.slice(0, 3).map(c => c.category);

    const weakest = categoryAverages.length
      ? categoryAverages[categoryAverages.length - 1].category
      : null;

    // PATTERN DETECTION
    let primaryPattern = "Your decision-making is moderately consistent.";
    let recommendedFocus = "Compare at least two options before committing.";

    if (distribution) {
      if (distribution.weak >= 50) {
        primaryPattern = "A large portion of your decisions are underperforming.";
        recommendedFocus = "Slow down decisions and evaluate alternatives.";
      } else if (distribution.strong >= 60) {
        primaryPattern = "You consistently make strong decisions.";
        recommendedFocus = "Maintain your current structured approach.";
      } else {
        primaryPattern = "Your results show inconsistency.";
        recommendedFocus = "Focus on reducing reactive decisions.";
      }
    }

    // HABIT ENGINE
    let bestNextHabit = "Compare at least two options before committing";

    if (highPressureBad > emotionalBad && highPressureBad > 2) {
      bestNextHabit = "Avoid making decisions under time pressure";
    } else if (emotionalBad > 2) {
      bestNextHabit = "Pause when decisions feel emotionally charged";
    }

    const recommendedAdjustments = [
      "Compare at least two options before committing",
      "Avoid rushed decisions",
      "Be aware of time pressure and emotional influence"
    ];

    return res.json({
      totalDecisions,
      evaluatedDecisions,
      averageRegretScore: avgScore,

      distribution,
      evaluationRate,
      followThroughRate,

      primaryPattern,
      recommendedFocus,

      behaviorReport: {
        strengths,
        currentBlindSpot: weakest,
        bestNextHabit,
        recommendedAdjustments
      },

      // 🧠 NEW COST INTELLIGENCE (non-breaking)
      costInsights: {
        totalSpend,
        expensiveMistakes,
        expensiveWins
      }

    });

  } catch (err) {
    console.error("INSIGHTS ERROR:", err);

    return res.json({
      totalDecisions: 0,
      evaluatedDecisions: 0,
      averageRegretScore: 0,
      distribution: null,
      evaluationRate: 0,
      followThroughRate: 0,
      behaviorReport: {
        strengths: [],
        currentBlindSpot: null,
        bestNextHabit: "",
        recommendedAdjustments: []
      },
      costInsights: {
        totalSpend: 0,
        expensiveMistakes: 0,
        expensiveWins: 0
      }
    });
  }
});

module.exports = router;