const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

/* 🔐 INVITE CODES (SIMPLE VERSION) */
const VALID_CODES = ["TEST123", "BETA2026"];

/* =========================
   REGISTER (LOCKED)
========================= */
router.post("/register", async (req, res) => {
  try {
    const { email, password, inviteCode } = req.body;

    // 🔒 REQUIRE INVITE CODE
    if (!inviteCode || !VALID_CODES.includes(inviteCode)) {
      return res.status(403).json({
        error: "Valid invite code required"
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
   LOGIN (UNCHANGED)
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
      process.env.JWT_SECRET || "secret",
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