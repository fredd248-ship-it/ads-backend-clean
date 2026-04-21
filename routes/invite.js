const express = require("express");
const router = express.Router();
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

const ADMIN_KEY = "your_custom_secret_here";

// Safe charset (no O, 0, I, l)
const CHARSET = "ABCDEFGHJKLMNPQRSTUVWXYZ123456789";

function generateToken(length = 8) {
  let token = "";
  for (let i = 0; i < length; i++) {
    token += CHARSET[Math.floor(Math.random() * CHARSET.length)];
  }
  return token;
}

/**
 * CREATE INVITE
 */
router.post("/create", async (req, res) => {
  try {
    const adminKey = req.headers["x-admin-key"];

    if (adminKey !== ADMIN_KEY) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    let token;
    let attempts = 0;

    // Prevent infinite loop
    while (attempts < 5) {
      token = generateToken(8);

      const existing = await prisma.invite.findUnique({
        where: { token }
      });

      if (!existing) break;

      attempts++;
    }

    if (!token) {
      return res.status(500).json({ error: "Failed to generate token" });
    }

    const invite = await prisma.invite.create({
      data: { token }
    });

    return res.json({ token });

  } catch (error) {
    console.error("INVITE CREATE ERROR:", error);
    return res.status(500).json({ error: "Server error" });
  }
});

/**
 * VALIDATE INVITE
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