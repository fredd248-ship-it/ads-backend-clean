const express = require("express");
const router = express.Router();
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

router.post("/create", async (req, res) => {
  try {
    const adminKey = req.headers["x-admin-key"];

    if (!process.env.ADMIN_KEY) {
      return res.status(500).json({
        success: false,
        error: "ADMIN_KEY not set in environment"
      });
    }

    if (adminKey !== process.env.ADMIN_KEY) {
      return res.status(401).json({
        success: false,
        error: "Unauthorized"
      });
    }

    const code =
      "ADS-" +
      Math.random().toString(36).substring(2, 8).toUpperCase();

    // ✅ WRITE ONLY token + used (matches your live DB)
    const invite = await prisma.invite.create({
      data: {
        token: code,
        used: false
      }
    });

    return res.json({
      success: true,
      code: invite.token
    });

  } catch (err) {
    console.error("INVITE ERROR:", err);

    return res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

module.exports = router;