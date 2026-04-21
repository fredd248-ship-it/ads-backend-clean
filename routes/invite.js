const express = require("express");
const router = express.Router();
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

// 🔒 ADMIN KEY (keep this secret)
const ADMIN_KEY = "your_custom_secret_here";

// ✅ SAFE CHARACTER SET (no O, 0, I, l)
const CHARSET = "ABCDEFGHJKLMNPQRSTUVWXYZ123456789";

// Generate safe token
function generateToken(length = 8) {
  let token = "";
  for (let i = 0; i < length; i++) {
    const index = Math.floor(Math.random() * CHARSET.length);
    token += CHARSET[index];
  }
  return token;
}

/**
 * POST /api/v1/invite/create
 * Headers: x-admin-key
 */
router.post("/create", async (req, res) => {
  try {
    const adminKey = req.headers["x-admin-key"];

    if (adminKey !== ADMIN_KEY) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    let token;
    let exists = true;

    // Ensure uniqueness
    while (exists) {
      token = generateToken(8);

      const existing = await prisma.invite.findUnique({
        where: { token }
      });

      if (!existing) {
        exists = false;
      }
    }

    const invite = await prisma.invite.create({
      data: {
        token
      }
    });

    return res.json({
      token: invite.token
    });

  } catch (error) {
    console.error("INVITE CREATE ERROR:", error);
    return res.status(500).json({ error: "Server error" });
  }
});

/**
 * POST /api/v1/invite/validate
 * Body: { token }
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