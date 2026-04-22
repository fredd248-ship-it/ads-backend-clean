const express = require("express");
const cors = require("cors");
const path = require("path");

const app = express();

/* =========================
   CORS FIX (CRITICAL)
========================= */
app.use(cors({
  origin: "*", // allow all for now (we can lock later)
  methods: ["GET", "POST", "PUT", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

/* =========================
   BODY PARSER
========================= */
app.use(express.json());

/* =========================
   STATIC FILES
========================= */
const publicPath = path.join(__dirname, "public");
console.log("Serving static from:", publicPath);
app.use(express.static(publicPath));

/* =========================
   ROUTES
========================= */
app.use("/api/v1/auth", require("./routes/auth"));
app.use("/api/v1/decisions", require("./routes/decisions"));
app.use("/api/v1/invite", require("./routes/invite"));

/* =========================
   FALLBACK
========================= */
app.get("*", (req, res) => {
  res.sendFile(path.join(publicPath, "index.html"));
});

/* =========================
   START SERVER
========================= */
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`API running on port ${PORT}`);
});