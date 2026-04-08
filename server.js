require("dotenv").config();

const express = require("express");
const cors = require("cors");

const authRoutes = require("./routes/auth");

const app = express();

app.use(cors());
app.use(express.json());

app.use("/api/v1/auth", authRoutes);

app.get("/", (req, res) => {
  res.send("API running");
});

const PORT = 5000;

app.listen(PORT, () => {
  console.log("Server running on port", PORT);
});