const express = require("express");
const router = express.Router();

/**
 * TEST CREATE ROUTE (NO DATABASE)
 */
router.post("/create", async (req, res) => {
  console.log("CREATE ROUTE HIT");
  return res.json({ token: "TEST1234" });
});

/**
 * TEST VALIDATE ROUTE (NO DATABASE)
 */
router.post("/validate", async (req, res) => {
  return res.json({ valid: true });
});

module.exports = router;