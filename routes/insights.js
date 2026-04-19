// FULL FILE — TRUE TEMPORAL COACHING ENGINE

const express = require("express");
const router = express.Router();
const { PrismaClient } = require("@prisma/client");

let prisma;
if (!global.prisma) {
  global.prisma = new PrismaClient();
}
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
  const diffDays = (now - created) / (1000 * 60 * 60 * 24);
  return diffDays <= 180;
}

function computeQualityScore(evaluation, decision) {
  const regretNorm = 1 - (evaluation.regretScore / 10);
  const freq = evaluation.frequencyOfUse === "High" ? 1 :
               evaluation.frequencyOfUse === "Medium" ? 0.6 : 0.2;
  const buy = evaluation.wouldBuyAgain ? 1 : 0;

  const time = (decision.timePressure ?? 5) / 10;
  const emotion = (decision.emotionalWeight ?? 5) / 10;

  const score =
    regretNorm * 0.35 +
    freq * 0.20 +
    buy * 0.20 +
    (1 - time * time) * 0.15 +
    (1 - emotion * emotion) * 0.10;

  return Math.round(score * 100);
}

/* TEMPORAL DISTRIBUTION */

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

/* CATEGORY + TREND */

function buildCategoryInsights(decisions, scores) {
  const map = {};
  const counts = {};

  decisions.forEach(d => {
    const cat = d.category || "other";
    counts[cat] = (counts[cat] || 0) + 1;

    if (!d.evaluations.length) return;

    const s = scores.find(x => x.id === d.id);
    if (!s) return;

    if (!map[cat]) map[cat] = { recent: [], older: [], weightedSum: 0, weight: 0 };

    map[cat].weightedSum += s.displayScore * s.weight;
    map[cat].weight += s.weight;

    if (isRecent(d.createdAt)) map[cat].recent.push(s.displayScore);
    else map[cat].older.push(s.displayScore);
  });

  let bestCategory = null, worstCategory = null;
  let best = -Infinity, worst = Infinity;

  const trends = {};

  Object.entries(map).forEach(([cat, obj]) => {
    const avg = obj.weight > 0 ? obj.weightedSum / obj.weight : 0;

    if (avg > best) { best = avg; bestCategory = cat; }
    if (avg < worst) { worst = avg; worstCategory = cat; }

    if (obj.recent.length && obj.older.length) {
      const r = obj.recent.reduce((a,b)=>a+b,0)/obj.recent.length;
      const o = obj.older.reduce((a,b)=>a+b,0)/obj.older.length;

      if (r > o + 1) trends[cat] = "improving";
      else if (r < o - 1) trends[cat] = "declining";
      else trends[cat] = "stable";
    }
  });

  let mostUsedCategory = Object.entries(counts)
    .sort((a,b)=>b[1]-a[1])[0]?.[0] || null;

  return {
    mostUsedCategory,
    bestCategory,
    worstCategory,
    trends
  };
}

/* 🔴 TRUE TEMPORAL COACHING ENGINE */

function buildBehaviorReport(scores, decisions, categoryData) {
  if (!scores || scores.length < 3) return null;

  const strong = [];
  const weak = [];

  Object.entries(categoryData.trends || {}).forEach(([cat]) => {
    if (cat === categoryData.bestCategory) strong.push(formatCategory(cat));
    if (cat === categoryData.worstCategory) weak.push(formatCategory(cat));
  });

  let trendLine = "";

  Object.entries(categoryData.trends).forEach(([cat, trend]) => {
    if (trend === "declining") {
      trendLine += `${formatCategory(cat)} shows declining recent performance. `;
    }
    if (trend === "improving") {
      trendLine += `${formatCategory(cat)} is improving over time. `;
    }
  });

  let narrative = "";

  narrative += "Your decision-making shows a mix of strong and weaker outcomes across different categories. ";

  if (strong.length) {
    narrative += `You consistently perform well in categories like ${strong.join(", ")}, where results remain stable over time. `;
  }

  if (weak.length) {
    narrative += `However, categories such as ${weak.join(" and ")} show lower outcomes, particularly in your more recent decisions. `;
  }

  narrative += trendLine;

  narrative += "Recent decisions now carry more weight in your results, meaning your current habits are actively shaping your performance. ";

  narrative += "Decisions made under time pressure or emotional urgency tend to reduce consistency and satisfaction. ";

  narrative += "Focusing on slowing down and applying a structured approach in weaker categories will likely produce immediate improvements.";

  return {
    decisionProfile: "Your decision-making is evolving over time",
    coachingSummary: narrative,
    currentBlindSpot: weak.join(", ") || "None",
    bestNextHabit: "Be more deliberate in weaker categories",
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
    if (!req.user?.id) {
      return res.status(401).json({ error: "Unauthorized" });
    }

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

    const categoryData = buildCategoryInsights(decisions, scores);

    return res.json({
      totalDecisions: decisions.length,
      evaluatedDecisions: scores.length,
      evaluationRate: Math.round((scores.length / (decisions.length || 1)) * 100),
      followThroughRate: Math.round((buyAgain / (totalEval || 1)) * 100),
      averageRegretScore: scores.length
        ? Math.round(scores.reduce((s,x)=>s+x.displayScore*x.weight,0) /
                     scores.reduce((s,x)=>s+x.weight,0))
        : 0,
      distribution: buildDistribution(scores),
      mostUsedCategory: categoryData.mostUsedCategory,
      bestCategory: categoryData.bestCategory,
      worstCategory: categoryData.worstCategory,
      behaviorReport: buildBehaviorReport(scores, decisions, categoryData)
    });

  } catch (err) {
    console.error("INSIGHTS ERROR:", err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;