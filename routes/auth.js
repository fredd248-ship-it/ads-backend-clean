const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

/*
  REGISTER (INVITE REQUIRED - FINAL)
*/
router.post("/register", async (req, res) => {
  try {
    let { email, password, inviteCode } = req.body;

    // Normalize
    if (inviteCode) {
      inviteCode = inviteCode.trim().toUpperCase();
    }

    if (!email || !password || !inviteCode) {
      return res.status(400).json({
        success: false,
        error: "Email, password, and invite code are required"
      });
    }

    // ✅ LOOKUP USING NEW FIELD (code)
    const invite = await prisma.invite.findUnique({
      where: { code: inviteCode }
    });

    if (!invite) {
      return res.status(400).json({
        success: false,
        error: "Invalid access code"
      });
    }

    if (invite.isUsed) {
      return res.status(400).json({
        success: false,
        error: "Access code already used"
      });
    }

    const existingUser = await prisma.user.findUnique({
      where: { email }
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        error: "User already exists"
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword
      }
    });

    // ✅ MARK USED (new schema)
    await prisma.invite.update({
      where: { code: inviteCode },
      data: { isUsed: true }
    });

    const token = jwt.sign(
      { id: user.id },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    return res.json({
      success: true,
      token
    });

  } catch (error) {
    console.error("REGISTER ERROR:", error);

    return res.status(500).json({
      success: false,
      error: "Server error"
    });
  }
});

/*
  LOGIN
*/
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await prisma.user.findUnique({
      where: { email }
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        error: "Invalid credentials"
      });
    }

    const valid = await bcrypt.compare(password, user.password);

    if (!valid) {
      return res.status(400).json({
        success: false,
        error: "Invalid credentials"
      });
    }

    const token = jwt.sign(
      { id: user.id },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    return res.json({
      success: true,
      token
    });

  } catch (error) {
    console.error("LOGIN ERROR:", error);

    return res.status(500).json({
      success: false,
      error: "Server error"
    });
  }
});

module.exports = router;