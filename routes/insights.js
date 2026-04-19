const express = require("express");
const router = express.Router();
const { PrismaClient } = require("@prisma/client");

let prisma;
if (!global.prisma) global.prisma = new PrismaClient();
prisma = global.prisma;

async function withTimeout(promise, ms = 8000) {
  const timeout = new Promise((_, reject) =>
    setTimeout(() => reject(new Error("DB_TIMEOUT")), ms)
  );
  return Promise.race([promise, timeout]);
}

/* HELPERS */

function formatCategory(cat) {
  return cat.replace("_", " ").replace(/\b\w/g, l => l.toUpperCase());
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
  const regret = 1 - (evaluation.regretScore / 10);
  const freq =
    evaluation.frequencyOfUse === "High"
      ? 1
      : evaluation.frequencyOfUse === "Medium"
      ? 0.6
      : 0.2;
  const buy = evaluation.wouldBuyAgain ? 1 : 0;

  const time = (decision.timePressure ?? 5) / 10;
  const emotion = (decision.emotionalWeight ?? 5) / 10;

  return Math.round(
    (regret * 0.35 +
      freq * 0.2 +
      buy * 0.2 +
      (1 - time * time) * 0.15 +
      (1 - emotion * emotion) * 0.1) *
      100
  );
}

/* DISTRIBUTION */

function buildDistribution(scores) {
  if (!scores.length) return null;

  let strong = 0,
    avg = 0,
    weak = 0,
    total = 0;

  scores.forEach((s) => {
    total += s.weight;
    if (s.displayScore >= 8) strong += s.weight;
    else if (s.displayScore >= 5) avg += s.weight;
    else weak += s.weight;
  });

  return {
    strong: Math.round((strong / total) * 100),
    average: Math.round((avg / total) * 100),
    weak: Math.round((weak / total) * 100),
  };
}

/* SIGNAL EXTRACTION */

function extractSignals(decisions, scores) {
  const categoryMap = {};
  const counts = {};

  let highTime = [],
    lowTime = [];
  let highEmotion = [],
    lowEmotion = [];

  decisions.forEach((d) => {
    const cat = d.category || "other";
    counts[cat] = (counts[cat] || 0) + 1;

    if (!d.evaluations.length) return;

    const s = scores.find((x) => x.id === d.id);
    if (!s) return;

    if (!categoryMap[cat]) {
      categoryMap[cat] = { weighted: 0, weight: 0 };
    }

    categoryMap[cat].weighted += s.displayScore * s.weight;
    categoryMap[cat].weight += s.weight;

    if ((d.timePressure ?? 5) >= 7) highTime.push(s.displayScore);
    if ((d.timePressure ?? 5) <= 4) lowTime.push(s.displayScore);

    if ((d.emotionalWeight ?? 5) >= 7) highEmotion.push(s.displayScore);
    if ((d.emotionalWeight ?? 5) <= 4) lowEmotion.push(s.displayScore);
  });

  let best = null,
    worst = null;
  let bestVal = -Infinity,
    worstVal = Infinity;

  Object.entries(categoryMap).forEach(([cat, obj]) => {
    const avg = obj.weight ? obj.weighted / obj.weight : 0;

    if (avg > bestVal) {
      bestVal = avg;
      best = cat;
    }
    if (avg < worstVal) {
      worstVal = avg;
      worst = cat;
    }
  });

  return {
    counts,
    best,
    worst,
    highTime,
    lowTime,
    highEmotion,
    lowEmotion,
  };
}

/* 🧠 COACHING ENGINE */

function buildBehaviorReport(scores, decisions) {
  if (!scores || scores.length < 2) return null;

  const signals = extractSignals(decisions, scores);

  const strong = signals.best ? [formatCategory(signals.best)] : [];
  const weak =
    signals.worst && signals.worst !== signals.best
      ? [formatCategory(signals.worst)]
      : [];

  const blocks = [];

  blocks.push(
    "You're making consistently strong decisions overall, which indicates that your core decision-making process is sound."
  );

  if (strong.length) {
    blocks.push(
      `You consistently perform well in categories like ${strong.join(
        ", "
      )}, where your approach appears more structured and reliable.`
    );
  }

  if (weak.length) {
    blocks.push(
      `In contrast, your results drop in ${weak.join(
        " and "
      )}, where outcomes are less predictable.`
    );
  }

  blocks.push(
    "Your decisions are distributed across strong, average, and weak categories. This doesn’t point to a lack of ability—it points to inconsistency in execution."
  );

  if (weak.length === 1) {
    blocks.push(
      `The category that consistently underperforms—${weak[0]}—represents your clearest opportunity for improvement right now.`
    );
  } else if (weak.length > 1) {
    blocks.push(
      `The categories that consistently underperform—${weak.join(
        " and "
      )}—represent your clearest opportunities for improvement right now.`
    );
  }

  blocks.push(
    "Your recent decisions suggest that your outcomes are closely tied to how you approach decisions in the moment."
  );

  blocks.push(
    "Time pressure and emotional weight are the two factors that most often influence your results."
  );

  return {
    decisionProfile:
      "Your decision-making reflects patterns that can be refined over time",
    coachingSummary: blocks.join(" "),
    currentBlindSpot: weak.length ? weak.join(", ") : null,
    bestNextHabit:
      "Slow down and evaluate your options before committing to important decisions",
    strengths: strong,

    /* ✅ NORMALIZED LANGUAGE */
    recommendedAdjustments: [
      "Comparing at least two options before committing",
      "Avoiding rushed decisions",
      "Being aware of time pressure and emotional influence",
    ],
  };
}

/* ROUTE */

router.get("/", async (req, res) => {
  try {
    if (!req.user?.id)
      return res.status(401).json({ error: "Unauthorized" });

    const decisions = await withTimeout(
      prisma.decision.findMany({
        where: { userId: req.user.id },
        include: { evaluations: true },
      })
    );

    let scores = [],
      totalEval = 0,
      buyAgain = 0;

    decisions.forEach((d) => {
      d.evaluations.forEach((e) => {
        totalEval++;
        if (e.wouldBuyAgain) buyAgain++;
      });

      if (d.evaluations.length) {
        const e = d.evaluations.at(-1);
        const raw = computeQualityScore(e, d);

        scores.push({
          id: d.id,
          displayScore: Math.round(raw / 10),
          weight: getRecencyWeight(d.createdAt),
        });
      }
    });

    const signals = extractSignals(decisions, scores);

    res.json({
      totalDecisions: decisions.length,
      evaluatedDecisions: scores.length,
      evaluationRate: Math.round(
        (scores.length / (decisions.length || 1)) * 100
      ),
      followThroughRate: Math.round(
        (buyAgain / (totalEval || 1)) * 100
      ),
      averageRegretScore: scores.length
        ? Math.round(
            scores.reduce((s, x) => s + x.displayScore * x.weight, 0) /
              scores.reduce((s, x) => s + x.weight, 0)
          )
        : 0,
      distribution: buildDistribution(scores),
      mostUsedCategory: Object.entries(signals.counts)
        .sort((a, b) => b[1] - a[1])[0]?.[0] || null,
      bestCategory: signals.best,
      worstCategory: signals.worst,
      behaviorReport: buildBehaviorReport(scores, decisions),
    });
  } catch (err) {
    console.error("INSIGHTS ERROR:", err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;