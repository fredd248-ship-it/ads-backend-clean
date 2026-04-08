const express = require("express");
const cors = require("cors");
require("dotenv").config();

const app = express();

/* CORS */
app.use(cors({
  origin: [
    "http://localhost:3000",
    "http://127.0.0.1:5500",
    "https://ads-frontend-2ain.onrender.com"
  ],
  credentials: true
}));

app.use(express.json());

/* ROUTES */
const authRoutes = require("./routes/auth");
const decisionRoutes = require("./routes/decisions");
const insightsRoutes = require("./routes/insights");

app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/decisions", decisionRoutes);
app.use("/api/v1/insights", insightsRoutes);

/* HEALTH CHECK */
app.get("/", (req, res) => {
  res.send("API running");
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});