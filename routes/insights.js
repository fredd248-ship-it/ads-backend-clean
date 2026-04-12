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

  const timeNorm = (decision.timePressure ?? 5) / 10;
  const emotionNorm = (decision.emotionalWeight ?? 5) / 10;

  const score =
    (regretNorm * 0.35) +
    (frequencyNorm * 0.20) +
    (buyAgainNorm * 0.20) +
    ((1 - timeNorm) * 0.15) +
    ((1 - emotionNorm) * 0.10);

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

/* BEHAVIOR ENGINE */

function buildBehaviorReport(scores) {

  let total = scores.length;
  let low = scores.filter(s => s.displayScore <= 4).length;
  let high = scores.filter(s => s.displayScore >= 7).length;

  let emotionCount = 0;
  let pressureCount = 0;
  let regretSignals = 0;

  scores.forEach(s => {
    s.explanation.forEach(e => {
      const text = e.toLowerCase();
      if (text.includes("emotional")) emotionCount++;
      if (text.includes("pressure")) pressureCount++;
      if (text.includes("not make this decision again")) regretSignals++;
    });
  });

  let decisionProfile = "Balanced decision maker";

  if (emotionCount > total * 0.4) {
    decisionProfile = "Emotion-driven decision maker";
  } else if (low > high) {
    decisionProfile = "Inconsistent decision outcomes";
  }

  let currentBlindSpot = "No dominant blind spot detected";

  if (emotionCount > total * 0.4) {
    currentBlindSpot = "Emotional pressure is influencing your decisions";
  } else if (pressureCount > total * 0.4) {
    currentBlindSpot = "Time pressure is reducing decision quality";
  }

  let bestNextHabit = "Maintain your current decision-making approach";

  if (emotionCount > total * 0.4) {
    bestNextHabit = "Pause before committing when emotional intensity is high";
  } else if (pressureCount > total * 0.4) {
    bestNextHabit = "Delay decisions when under time pressure";
  }

  let strengths = [];
  if (high >= low) strengths.push("You are making generally strong decisions");
  if (regretSignals === 0) strengths.push("You rarely regret your decisions");

  let riskAreas = [];
  if (emotionCount > 0) riskAreas.push("Emotion-driven decisions");
  if (pressureCount > 0) riskAreas.push("Time-pressure decisions");
  if (low > high) riskAreas.push("Inconsistent outcomes");

  let recommendedAdjustments = [];
  if (emotionCount > 0) recommendedAdjustments.push("Introduce a pause before emotional decisions");
  if (pressureCount > 0) recommendedAdjustments.push("Avoid rushed decisions when possible");
  if (low > high) recommendedAdjustments.push("Review past decisions before making similar ones");

  let coachingSummary = "Your decision patterns appear stable";
  if (emotionCount > total * 0.4) coachingSummary = "Emotional decisions are impacting your outcomes";
  else if (low > high) coachingSummary = "You may benefit from a more structured decision process";

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

/* NEW: INSIGHT SUMMARY ENGINE */

function buildInsightSummary(scores) {

  let total = scores.length;
  let low = scores.filter(s => s.displayScore <= 4).length;
  let high = scores.filter(s => s.displayScore >= 7).length;

  let emotionCount = 0;
  let pressureCount = 0;

  scores.forEach(s => {
    s.explanation.forEach(e => {
      const text = e.toLowerCase();
      if (text.includes("emotional")) emotionCount++;
      if (text.includes("pressure")) pressureCount++;
    });
  });

  let primaryPattern = {
    text: "Your decisions are generally stable",
    severity: "low"
  };

  if (emotionCount > total * 0.4) {
    primaryPattern = {
      text: "Emotional decisions are reducing overall quality",
      severity: "high"
    };
  } else if (pressureCount > total * 0.4) {
    primaryPattern = {
      text: "Time pressure is impacting decision quality",
      severity: "high"
    };
  } else if (low > high) {
    primaryPattern = {
      text: "Decision outcomes are inconsistent",
      severity: "medium"
    };
  }

  let secondaryPattern = null;

  if (pressureCount > total * 0.2 && pressureCount <= total * 0.4) {
    secondaryPattern = {
      text: "Some decisions are made under time pressure",
      severity: "medium"
    };
  }

  let stability = {
    text: "Your decision-making is consistent",
    severity: "low"
  };

  if (Math.abs(high - low) <= 1) {
    stability = {
      text: "Your results are mixed and may need refinement",
      severity: "medium"
    };
  }

  let recommendedFocus = {
    text: "Maintain your current approach",
    severity: "low"
  };

  if (emotionCount > total * 0.4) {
    recommendedFocus = {
      text: "Slow down decisions when emotional intensity is high",
      severity: "high"
    };
  } else if (pressureCount > total * 0.4) {
    recommendedFocus = {
      text: "Avoid making decisions under time pressure",
      severity: "high"
    };
  } else if (low > high) {
    recommendedFocus = {
      text: "Introduce a more structured decision process",
      severity: "medium"
    };
  }

  return {
    primaryPattern,
    secondaryPattern,
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

    const behaviorReport = buildBehaviorReport(scores);
    const insightSummary = buildInsightSummary(scores);

    return res.json({
      totalDecisions,
      evaluatedDecisions,
      averageScore,
      bestDecision,
      worstDecision,
      scores,
      behaviorReport,
      insightSummary
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;