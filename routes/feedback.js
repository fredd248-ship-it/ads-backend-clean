const express = require('express');
const router = express.Router();

const nodemailer = require('nodemailer');

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const authenticate = require('../middleware/authenticate');

/* =========================
   EMAIL TRANSPORT
========================= */
const transporter = nodemailer.createTransport({

  service: 'gmail',

  auth: {

    user:
      process.env.EMAIL_USER,

    pass:
      process.env.EMAIL_PASS
  }
});

/* =========================
   GET FEEDBACK
========================= */
router.get('/', async (req, res) => {

  try {

    const feedback =
      await prisma.feedback.findMany({

        orderBy: {
          createdAt: 'desc'
        },

        include: {
          user: {
            select: {
              email: true
            }
          }
        }
      });

    res.json({
      success: true,
      data: feedback
    });

  } catch (err) {

    console.error(
      'GET FEEDBACK ERROR:',
      err
    );

    res.status(500).json({
      success: false,
      error: 'Failed to fetch feedback'
    });
  }
});

/* =========================
   SUBMIT FEEDBACK
========================= */
router.post('/', authenticate, async (req, res) => {

  try {

    const {
      type,
      message,
      email
    } = req.body;

    if (
      !type ||
      !message
    ) {

      return res.status(400).json({
        success: false,
        error: 'Type and message are required'
      });
    }

    /* =========================
       SAVE FEEDBACK FIRST
    ========================= */
    const feedback =
      await prisma.feedback.create({

        data: {

          type,

          message,

          email:
            email || null,

          userId:
            req.user.id
        },

        include: {
          user: {
            select: {
              email: true
            }
          }
        }
      });

    /* =========================
       EMAIL NOTIFICATION
    ========================= */
    try {

      await transporter.sendMail({

        from:
          process.env.EMAIL_USER,

        to:
          process.env.EMAIL_USER,

        subject:
          `New OutcomeClarity Feedback - ${type}`,

        text: `
New Feedback Submitted

Type:
${type}

Message:
${message}

Optional Contact Email:
${email || 'Not Provided'}

User Account Email:
${feedback.user?.email || 'Unknown'}

Submitted:
${new Date(
  feedback.createdAt
).toLocaleString()}
        `
      });

      console.log(
        'FEEDBACK EMAIL SENT'
      );

    } catch(emailErr){

      console.error(
        'EMAIL SEND ERROR:',
        emailErr
      );
    }

    /* =========================
       SUCCESS RESPONSE
    ========================= */
    res.json({
      success: true,
      data: feedback
    });

  } catch (err) {

    console.error(
      'FEEDBACK ERROR:',
      err
    );

    res.status(500).json({
      success: false,
      error: 'Failed to submit feedback'
    });
  }
});

module.exports = router;