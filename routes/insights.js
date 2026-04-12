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

/* DIAGNOSTIC INSIGHT ENGINE */

function buildInsightSummary(scores) {

  let total = scores.length;
  let low = scores.filter(s => s.displayScore <= 4);
  let high = scores.filter(s => s.displayScore >= 7);

  let emotionLow = 0;
  let emotionTotal = 0;

  let pressureLow = 0;
  let pressureTotal = 0;

  scores.forEach(s => {

    const hasEmotion = s.explanation.some(e =>
      e.toLowerCase().includes("emotional")
    );

    const hasPressure = s.explanation.some(e =>
      e.toLowerCase().includes("pressure")
    );

    if (hasEmotion) {
      emotionTotal++;
      if (s.displayScore <= 4) emotionLow++;
    }

    if (hasPressure) {
      pressureTotal++;
      if (s.displayScore <= 4) pressureLow++;
    }

  });

  // --- DETERMINE CAUSE ---

  let primaryPattern = {
    text: "Your decisions are generally stable",
    severity: "low"
  };

  if (emotionTotal > 0) {
    const emotionRate = emotionLow / emotionTotal;

    if (emotionRate > 0.5) {
      primaryPattern = {
        text: "Decisions made under emotional pressure tend to perform poorly",
        severity: "high"
      };
    }
  }

  if (pressureTotal > 0) {
    const pressureRate = pressureLow / pressureTotal;

    if (pressureRate > 0.5) {
      primaryPattern = {
        text: "Decisions made under time pressure tend to perform poorly",
        severity: "high"
      };
    }
  }

  // fallback if no strong condition detected
  if (primaryPattern.severity === "low" && low.length > high.length) {
    primaryPattern = {
      text: "Decision outcomes are inconsistent",
      severity: "medium"
    };
  }

  // --- STABILITY (correct logic) ---
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

  // --- RECOMMENDED FOCUS ---
  let recommendedFocus = {
    text: "Maintain your current approach",
    severity: "low"
  };

  if (primaryPattern.text.includes("emotional")) {
    recommendedFocus = {
      text: "Pause before making decisions when emotions are high",
      severity: "high"
    };
  } else if (primaryPattern.text.includes("time pressure")) {
    recommendedFocus = {
      text: "Avoid making rushed decisions under time pressure",
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
    secondaryPattern: null,
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