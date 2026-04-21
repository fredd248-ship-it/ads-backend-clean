const express = require("express");
const router = express.Router();
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

/**
 * POST /api/v1/invite/validate
 * Body: { token }
 */
router.post("/validate", async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ valid: false, error: "Token required" });
    }

    const invite = await prisma.invite.findUnique({
      where: { token }
    });

    if (!invite) {
      return res.json({ valid: false });
    }

    if (invite.used) {
      return res.json({ valid: false });
    }

    return res.json({ valid: true });

  } catch (error) {
    console.error("INVITE VALIDATION ERROR:", error);
    return res.status(500).json({ valid: false });
  }
});

module.exports = router;