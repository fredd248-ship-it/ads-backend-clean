const express = require("express");
const router = express.Router();
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

function generateInviteCode(length = 6) {
  const chars =
    "ABCDEFGHJKLMNPQRTUVWXYZ2346789";

  let result = "";

  for (let i = 0; i < length; i++) {
    result += chars.charAt(
      Math.floor(Math.random() * chars.length)
    );
  }

  return `ADS-${result}`;
}

router.post("/create", async (req, res) => {
  try {
    const adminKey = req.headers["x-admin-key"];

    if (!process.env.ADMIN_KEY) {
      return res.status(500).json({
        success: false,
        error: "ADMIN_KEY not set in environment",
      });
    }

    if (adminKey !== process.env.ADMIN_KEY) {
      return res.status(401).json({
        success: false,
        error: "Unauthorized",
      });
    }

    const code = generateInviteCode();

    const invite = await prisma.invite.create({
      data: {
        code: code,
        isUsed: false,
      },
    });

    return res.json({
      success: true,
      code: invite.code,
    });
  } catch (err) {
    console.error("INVITE ERROR:", err);

    return res.status(500).json({
      success: false,
      error: err.message,
    });
  }
});

module.exports = router;