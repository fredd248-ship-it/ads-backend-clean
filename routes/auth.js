const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

const JWT_SECRET = process.env.JWT_SECRET || "supersecretkey";

/* =========================
   REGISTER (HARDENED)
========================= */
router.post("/register", async (req, res) => {
  try {
    let { email, password, inviteToken } = req.body;

    // Normalize input
    if (inviteToken) {
      inviteToken = inviteToken.trim().toUpperCase();
    }

    if (!email || !password || !inviteToken) {
      return res.status(400).json({ error: "Missing fields" });
    }

    console.log("REGISTER ATTEMPT TOKEN:", inviteToken);

    const invite = await prisma.invite.findUnique({
      where: { token: inviteToken }
    });

    console.log("DB LOOKUP RESULT:", invite);

    if (!invite || invite.used) {
      return res.status(400).json({
        error: "Invalid access code"
      });
    }

    const existingUser = await prisma.user.findUnique({
      where: { email }
    });

    if (existingUser) {
      return res.status(400).json({
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

    await prisma.invite.update({
      where: { token: inviteToken },
      data: { used: true }
    });

    return res.json({ success: true });

  } catch (error) {
    console.error("REGISTER ERROR:", error);
    return res.status(500).json({ error: "Server error" });
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
    return res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;