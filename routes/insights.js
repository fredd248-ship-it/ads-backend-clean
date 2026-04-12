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

function generateExplanation(evaluation, decision) {
  const messages = [];

  if (decision.emotionalWeight >= 7) {
    messages.push("High emotional influence may have impacted this decision");
  }

  if (decision.timePressure >= 7) {
    messages.push("This decision was made under time pressure");
  }

  if (evaluation.wouldBuyAgain === false) {
    messages.push("You would not make this decision again");
  }

  const freq = mapFrequency(evaluation.frequencyOfUse);

  if (freq >= 0.7) {
    messages.push("This decision is used frequently and provides value");
  } else if (freq <= 0.2) {
    messages.push("This decision sees little use");
  }

  if (messages.length === 0) {
    messages.push("This appears to be a stable, balanced decision");
  }

  return messages;
}

/* 🔥 NEW: CATEGORY ANALYSIS */

function analyzeCategories(scores) {

  const categories = {};

  scores.forEach(s => {
    const cat = s.category || "other";

    if (!categories[cat]) {
      categories[cat] = [];
    }

    categories[cat].push(s.displayScore);
  });

  let bestCategory = null;
  let worstCategory = null;

  Object.keys(categories).forEach(cat => {
    const avg =
      categories[cat].reduce((a, b) => a + b, 0) /
      categories[cat].length;

    if (!bestCategory || avg > bestCategory.avg) {
      bestCategory = { name: cat, avg };
    }

    if (!worstCategory || avg < worstCategory.avg) {
      worstCategory = { name: cat, avg };
    }
  });

  return { bestCategory, worstCategory };
}

/* INSIGHT ENGINE (UPDATED) */

function buildInsightSummary(scores) {

  let total = scores.length;
  let low = scores.filter(s => s.displayScore <= 4);
  let high = scores.filter(s => s.displayScore >= 7);

  const { bestCategory, worstCategory } = analyzeCategories(scores);

  let primaryPattern = {
    text: "Your decisions are generally stable",
    severity: "low"
  };

  // 🔥 CATEGORY-DRIVEN INSIGHT
  if (worstCategory && worstCategory.avg <= 5) {
    primaryPattern = {
      text: `${worstCategory.name} decisions tend to perform poorly`,
      severity: "high"
    };
  } else if (low.length > high.length) {
    primaryPattern = {
      text: "Decision outcomes are inconsistent",
      severity: "medium"
    };
  }

  let stability = {
    text: "Your decision-making is consistent",
    severity: "low"
  };

  if (low.length > 0 && high.length > 0) {
    stability = {
      text: "Your decision outcomes are inconsistent",
      severity: "medium"
    };
  }

  let recommendedFocus = {
    text: "Maintain your current approach",
    severity: "low"
  };

  if (worstCategory && worstCategory.avg <= 5) {
    recommendedFocus = {
      text: `Improve decision-making in ${worstCategory.name} category`,
      severity: "high"
    };
  } else if (low.length > high.length) {
    recommendedFocus = {
      text: "Introduce a more structured decision process",
      severity: "medium"
    };
  }

  return {
    primaryPattern,
    secondaryPattern: bestCategory
      ? {
          text: `${bestCategory.name} decisions are your strongest`,
          severity: "low"
        }
      : null,
    stability,
    recommendedFocus
  };
}

/* ROUTE */

router.get("/", async (req, res) => {
  try {

    const decisions = await prisma.decision.findMany({
      include: { evaluations: true }
    });

    let scores = [];

    decisions.forEach(d => {
      if (d.evaluations.length > 0) {

        const latest = d.evaluations[d.evaluations.length - 1];

        const rawScore = computeQualityScore(latest, d);
        const displayScore = Math.round(rawScore / 10);
        const explanation = generateExplanation(latest, d);

        scores.push({
          id: d.id,
          title: d.title,
          category: d.category,
          displayScore,
          explanation
        });
      }
    });

    const totalDecisions = decisions.length;
    const evaluatedDecisions = scores.length;

    const averageScore =
      scores.length > 0
        ? Math.round(scores.reduce((a, b) => a + b.displayScore, 0) / scores.length)
        : 0;

    const sortedHigh = [...scores].sort((a, b) => b.displayScore - a.displayScore);
    const sortedLow = [...scores].sort((a, b) => a.displayScore - b.displayScore);

    const bestDecision = sortedHigh[0] || null;
    const worstDecision = sortedLow[0] || null;

    const insightSummary = buildInsightSummary(scores);

    return res.json({
      totalDecisions,
      evaluatedDecisions,
      averageScore,
      bestDecision,
      worstDecision,
      scores,
      insightSummary
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;