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

function isRecent(date) {
  const now = new Date();
  const created = new Date(date);
  return (now - created) / (1000 * 60 * 60 * 24) <= 180;
}

function computeQualityScore(evaluation, decision) {
  const regret = 1 - (evaluation.regretScore / 10);
  const freq = evaluation.frequencyOfUse === "High" ? 1 :
               evaluation.frequencyOfUse === "Medium" ? 0.6 : 0.2;
  const buy = evaluation.wouldBuyAgain ? 1 : 0;

  const time = (decision.timePressure ?? 5) / 10;
  const emotion = (decision.emotionalWeight ?? 5) / 10;

  return Math.round((
    regret * 0.35 +
    freq * 0.20 +
    buy * 0.20 +
    (1 - time * time) * 0.15 +
    (1 - emotion * emotion) * 0.10
  ) * 100);
}

/* DISTRIBUTION */

function buildDistribution(scores) {
  if (!scores.length) return null;

  let strong = 0, avg = 0, weak = 0, total = 0;

  scores.forEach(s => {
    total += s.weight;
    if (s.displayScore >= 8) strong += s.weight;
    else if (s.displayScore >= 5) avg += s.weight;
    else weak += s.weight;
  });

  return {
    strong: Math.round((strong / total) * 100),
    average: Math.round((avg / total) * 100),
    weak: Math.round((weak / total) * 100)
  };
}

/* CATEGORY + SIGNAL EXTRACTION */

function extractSignals(decisions, scores) {
  const categoryMap = {};
  const counts = {};

  let highTime = [], lowTime = [];
  let highEmotion = [], lowEmotion = [];

  decisions.forEach(d => {
    const cat = d.category || "other";
    counts[cat] = (counts[cat] || 0) + 1;

    if (!d.evaluations.length) return;

    const s = scores.find(x => x.id === d.id);
    if (!s) return;

    if (!categoryMap[cat]) {
      categoryMap[cat] = { weighted: 0, weight: 0, recent: [], older: [] };
    }

    categoryMap[cat].weighted += s.displayScore * s.weight;
    categoryMap[cat].weight += s.weight;

    if (isRecent(d.createdAt)) categoryMap[cat].recent.push(s.displayScore);
    else categoryMap[cat].older.push(s.displayScore);

    if ((d.timePressure ?? 5) >= 7) highTime.push(s.displayScore);
    if ((d.timePressure ?? 5) <= 4) lowTime.push(s.displayScore);

    if ((d.emotionalWeight ?? 5) >= 7) highEmotion.push(s.displayScore);
    if ((d.emotionalWeight ?? 5) <= 4) lowEmotion.push(s.displayScore);
  });

  let best = null, worst = null;
  let bestVal = -Infinity, worstVal = Infinity;

  Object.entries(categoryMap).forEach(([cat, obj]) => {
    const avg = obj.weight ? obj.weighted / obj.weight : 0;

    if (avg > bestVal) { bestVal = avg; best = cat; }
    if (avg < worstVal) { worstVal = avg; worst = cat; }
  });

  return {
    categoryMap,
    counts,
    best,
    worst,
    highTime,
    lowTime,
    highEmotion,
    lowEmotion
  };
}

/* 🧠 COACHING ENGINE V2 */

function buildBehaviorReport(scores, decisions) {
  if (!scores || scores.length < 2) return null;

  const signals = extractSignals(decisions, scores);

  const strong = [];
  const weak = [];

  if (signals.best) strong.push(formatCategory(signals.best));
  if (signals.worst && signals.worst !== signals.best) {
    weak.push(formatCategory(signals.worst));
  }

  const blocks = [];

  /* Opening */
  blocks.push(
    "Your decision-making shows a mix of strong and weaker outcomes. Overall, your core process is working, but results vary depending on how different decisions are approached."
  );

  /* Strengths */
  if (strong.length) {
    blocks.push(
      `You consistently perform well in categories like ${strong.join(", ")}, where your outcomes are more stable and reliable.`
    );
  }

  /* Weakness */
  if (weak.length) {
    blocks.push(
      `At the same time, categories such as ${weak.join(" and ")} show lower or less consistent results, indicating an opportunity to refine your approach.`
    );
  }

  /* Temporal Insight */
  let temporalLine = "";

  Object.entries(signals.categoryMap).forEach(([cat, obj]) => {
    if (obj.recent.length && obj.older.length) {
      const r = obj.recent.reduce((a,b)=>a+b,0)/obj.recent.length;
      const o = obj.older.reduce((a,b)=>a+b,0)/obj.older.length;

      if (r < o - 1) {
        temporalLine = `${formatCategory(cat)} shows weaker performance in your more recent decisions, suggesting a shift in how those decisions are being made.`;
      }
    }
  });

  if (temporalLine) blocks.push(temporalLine);

  /* Behavioral Insight */
  const avg = arr => arr.length ? arr.reduce((a,b)=>a+b,0)/arr.length : null;

  const timeHigh = avg(signals.highTime);
  const timeLow = avg(signals.lowTime);

  if (timeHigh && timeLow && timeHigh < timeLow) {
    blocks.push(
      "Decisions made under higher time pressure tend to produce lower satisfaction outcomes, indicating that rushed decisions may be impacting your results."
    );
  }

  const emoHigh = avg(signals.highEmotion);
  const emoLow = avg(signals.lowEmotion);

  if (emoHigh && emoLow && emoHigh !== emoLow) {
    blocks.push(
      "Emotional intensity also appears to influence your outcomes, introducing more variability when decisions carry higher emotional weight."
    );
  }

  /* Action */
  blocks.push(
    "A practical adjustment would be to slow down key decisions and compare multiple options before committing, especially in situations where you feel pressure or urgency."
  );

  /* Closing */
  blocks.push(
    "Overall, your decision-making foundation is strong. Improving consistency in how you approach different situations will likely produce the biggest gains."
  );

  return {
    decisionProfile: "Your decision-making reflects patterns that can be refined over time",
    coachingSummary: blocks.join(" "),
    currentBlindSpot: weak.length ? weak.join(", ") : null,
    bestNextHabit: "Be more deliberate before committing to important decisions",
    strengths: strong,
    recommendedAdjustments: [
      "Compare at least two options",
      "Avoid rushed decisions",
      "Be aware of time pressure and emotional influence"
    ]
  };
}

/* ROUTE */

router.get("/", async (req, res) => {
  try {
    if (!req.user?.id) return res.status(401).json({ error: "Unauthorized" });

    const decisions = await withTimeout(
      prisma.decision.findMany({
        where: { userId: req.user.id },
        include: { evaluations: true }
      })
    );

    let scores = [], totalEval = 0, buyAgain = 0;

    decisions.forEach(d => {
      d.evaluations.forEach(e => {
        totalEval++;
        if (e.wouldBuyAgain) buyAgain++;
      });

      if (d.evaluations.length) {
        const e = d.evaluations.at(-1);
        const raw = computeQualityScore(e, d);

        scores.push({
          id: d.id,
          displayScore: Math.round(raw / 10),
          weight: getRecencyWeight(d.createdAt)
        });
      }
    });

    const signals = extractSignals(decisions, scores);

    res.json({
      totalDecisions: decisions.length,
      evaluatedDecisions: scores.length,
      evaluationRate: Math.round((scores.length / (decisions.length || 1)) * 100),
      followThroughRate: Math.round((buyAgain / (totalEval || 1)) * 100),
      averageRegretScore: scores.length
        ? Math.round(scores.reduce((s,x)=>s+x.displayScore*x.weight,0) /
                     scores.reduce((s,x)=>s+x.weight,0))
        : 0,
      distribution: buildDistribution(scores),
      mostUsedCategory: Object.entries(signals.counts)
        .sort((a,b)=>b[1]-a[1])[0]?.[0] || null,
      bestCategory: signals.best,
      worstCategory: signals.worst,
      behaviorReport: buildBehaviorReport(scores, decisions)
    });

  } catch (err) {
    console.error("INSIGHTS ERROR:", err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;