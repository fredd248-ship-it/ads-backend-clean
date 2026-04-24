const express = require("express");
const router = express.Router();
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

/* =========================
   CREATE INVITE CODE (WITH DEBUG)
========================= */
router.post("/create", async (req, res) => {
  try {
    const adminKey = req.headers["x-admin-key"];
    const envKey = process.env.ADMIN_KEY;

    // 🔍 DEBUG RESPONSE (temporary)
    if (!envKey) {
      return res.status(500).json({
        success: false,
        error: "ADMIN_KEY not set in environment",
        debug: {
          receivedHeader: adminKey || null
        }
      });
    }

    if (!adminKey || adminKey !== envKey) {
      return res.status(401).json({
        success: false,
        error: "Unauthorized",
        debug: {
          receivedHeader: adminKey || null,
          expectedLength: envKey.length,
          receivedLength: adminKey ? adminKey.length : 0
        }
      });
    }

    // Generate code
    const code =
      "ADS-" +
      Math.random().toString(36).substring(2, 8).toUpperCase();

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