const express = require('express');
const router = express.Router();

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const authenticate = require('../middleware/authenticate');

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

    const feedback =
      await prisma.feedback.create({

        data: {

          type,

          message,

          email:
            email || null,

          userId:
            req.user.id
        }
      });

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