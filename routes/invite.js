const express = require("express");
const router = express.Router();
const { PrismaClient } = require("@prisma/client");

console.log("INVITE ROUTE VERSION 3 LOADED");

const prisma = new PrismaClient();

// 🔒 ADMIN KEY
const ADMIN_KEY = "your_custom_secret_here";

// ✅ SAFE CHARACTER SET (no O, 0, I, l)
const CHARSET = "ABCDEFGHJKLMNPQRSTUVWXYZ123456789";

// 🔁 Generate token
function generateToken(length = 8) {
  let token = "";
  for (let i = 0; i < length; i++) {
    token += CHARSET[Math.floor(Math.random() * CHARSET.length)];
  }
  return token;
}

/**
 * POST /api/v1/invite/create
 */
router.post("/create", async (req, res) => {
  try {
    const adminKey = req.headers["x-admin-key"];

    if (adminKey !== ADMIN_KEY) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    let token = null;

    // Try up to 5 times to avoid rare collisions
    for (let i = 0; i < 5; i++) {
      const candidate = generateToken(8);

      const existing = await prisma.invite.findUnique({
        where: { token: candidate }
      });

      if (!existing) {
        token = candidate;
        break;
      }
    }

    if (!token) {
      return res.status(500).json({ error: "Token generation failed" });
    }

    const invite = await prisma.invite.create({
      data: { token }
    });

    return res.json({ token: invite.token });

  } catch (error) {
    console.error("INVITE CREATE ERROR:", error);
    return res.status(500).json({ error: "Server error" });
  }
});

/**
 * POST /api/v1/invite/validate
 */
router.post("/validate", async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ valid: false });
    }

    const invite = await prisma.invite.findUnique({
      where: { token }
    });

    if (!invite || invite.used) {
      return res.json({ valid: false });
    }

    return res.json({ valid: true });

  } catch (error) {
    console.error("INVITE VALIDATION ERROR:", error);
    return res.status(500).json({ valid: false });
  }
});

module.exports = router;