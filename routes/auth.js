const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

/*
  REGISTER (CLEAN + PRODUCTION READY)
*/
router.post("/register", async (req, res) => {
  try {
    let { email, password } = req.body;

    email = (email || "").trim();
    password = (password || "").trim();

    // Minimal, useful log
    console.log("REGISTER:", {
      email,
      time: new Date().toISOString()
    });

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: "Email and password are required"
      });
    })


const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

/*
  REGISTER (CLEAN + PRODUCTION READY)
*/);

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

/*
  REGISTER (CLEAN + PRODUCTION READY)
*/;

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

/*
  REGISTER (CLEAN + PRODUCTION READY)
*/;

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

/*
  REGISTER (CLEAN + PRODUCTION READY)
*/;

/*
  REGISTER (CLEAN + PRODUCTION READY)
*/
  router.post("/register", async (req, res) => {
  try {
    let { email, password } = req.body;


  email = (email || "").trim();
  password = (password || "").trim();

    // Minimal, useful log
    console.log("REGISTER:", {
      email,
     
      time: new Date().toISOString()
    });

    if (!email || !password) {
  return res.status(400).json({
    success: false,
    error: "Email and password are required"
  });

    }

   
    // Check existing user
    const existingUser = await prisma.user.findUnique({
      where: { email }
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
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
  await transporter.sendMail({
  from: process.env.EMAIL_USER,
  to: "adssystemnotifications@gmail.com",
  subject: "New OutcomeClarity Registration",
  text:
 `A new user has registered.

Email: ${email}

User ID: ${user.id}

Time: ${new Date().toISOString()}`
});

   

    // Generate token
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