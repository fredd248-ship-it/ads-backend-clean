const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

const JWT_SECRET = process.env.JWT_SECRET || "supersecretkey";

/* =========================
   REGISTER (DB INVITE SYSTEM)
========================= */
router.post("/register", async (req, res) => {
  try {
    const { email, password, inviteToken } = req.body;

    // Require fields
    if (!email || !password || !inviteToken) {
      return res.status(400).json({ error: "Missing fields" });
    }

    // 🔍 Check invite in DB
    const invite = await prisma.invite.findUnique({
      where: { token: inviteToken }
    });

    if (!invite || invite.used) {
      return res.status(400).json({
        error: "Invalid access code"
      });
    }

    // Check existing user
    const existingUser = await prisma.user.findUnique({
      where: { email }
    });

    if (existingUser) {
      return res.status(400).json({
        error: "User already exists"
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword
      }
    });

    // 🔐 Mark invite as used
    await prisma.invite.update({
      where: { token: inviteToken },
      data: { used: true }
    });

    return res.json({
      success: true
    });

  } catch (error) {
    console.error("REGISTER ERROR:", error);
    return res.status(500).json({
      error: "Server error"
    });
  }
});

/* =========================
   LOGIN
========================= */
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await prisma.user.findUnique({
      where: { email }
    });

    if (!user) {
      return res.status(400).json({ error: "Invalid credentials" });
    }

    const valid = await bcrypt.compare(password, user.password);

    if (!valid) {
      return res.status(400).json({ error: "Invalid credentials" });
    }

    const token = jwt.sign(
      { id: user.id },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    return res.json({ token });

  } catch (error) {
    console.error("LOGIN ERROR:", error);
    return res.status(500).json({
      error: "Server error"
    });
  }
});

module.exports = router;