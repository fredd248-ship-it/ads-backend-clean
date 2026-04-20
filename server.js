const express = require("express");
const path = require("path");

const app = express();

/* =========================
   MIDDLEWARE
========================= */
app.use(express.json());

/* =========================
   ROUTES
========================= */
const authRoutes = require("./routes/auth");
const decisionRoutes = require("./routes/decisions");
const insightsRoutes = require("./routes/insights");
const inviteRoutes = require("./routes/invite");

app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/decisions", decisionRoutes);
app.use("/api/v1/insights", insightsRoutes);
app.use("/api/v1/invite", inviteRoutes);

/* =========================
   STATIC FRONTEND
========================= */
const publicPath = path.join(__dirname, "public");
console.log("Serving static from:", publicPath);

app.use(express.static(publicPath));

/* =========================
   ROOT → LANDING PAGE
========================= */
app.get("/", (req, res) => {
  res.sendFile(path.join(publicPath, "index.html"));
});

/* =========================
   START SERVER
========================= */
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log("API running on port " + PORT);
});