const express = require("express");
const router = express.Router();
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

/* =========================
   CREATE INVITE CODE
========================= */
router.post("/create", async (req, res) => {
  try {
    const adminKey = req.headers["x-admin-key"];

    if (!adminKey || adminKey !== process.env.ADMIN_KEY) {
      return res.status(401).json({
        success: false,
        error: "Unauthorized"
      });
    }

    // Generate simple readable code
    const code = "ADS-" + Math.random().toString(36).substring(2, 8).toUpperCase();

    const invite = await prisma.invite.create({
      data: {
        code: code,
        isUsed: false
      }
    });

    return res.json({
      success: true,
      code: invite.code
    });

  } catch (err) {
    console.error("INVITE ERROR:", err);

    return res.status(500).json({
      success: false,
      error: "Server error"
    });
  }
});

/* =========================
   BASIC ROUTE TEST
========================= */
router.get("/", (req, res) => {
  res.send("Invite route active");
});

module.exports = router;