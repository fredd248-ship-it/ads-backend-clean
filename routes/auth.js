const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
require("dotenv").config();

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const router = express.Router();

/* REGISTER */
router.post("/register", async (req, res) => {
  try {
    let { email, password } = req.body;

    email = email?.trim().toLowerCase();
    password = password?.trim();

    if (!email || !password) {
      return res.status(400).json({ error: "Missing fields" });
    }

    const exists = await prisma.user.findUnique({ where: { email } });

    if (exists) {
      return res.status(400).json({ error: "User exists" });
    }

    const hash = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: { email, password: hash },
    });

    const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, {
      expiresIn: "1d",
    });

    res.json({ token });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

/* LOGIN */
router.post("/login", async (req, res) => {
  try {
    let { email, password } = req.body;

    email = email?.trim().toLowerCase();
    password = password?.trim();

    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const valid = await bcrypt.compare(password, user.password);

    if (!valid) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, {
      expiresIn: "1d",
    });

    res.json({ token });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

/* DEBUG */
router.get("/debug-users", async (req, res) => {
  const users = await prisma.user.findMany({
    select: { id: true, email: true },
  });

  res.json({ count: users.length, users });
});

module.exports = router;