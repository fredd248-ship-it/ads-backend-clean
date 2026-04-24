const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();

/* =========================
   CORS (FINAL CLEAN)
========================= */
app.use(cors({
  origin: [
    'https://outcomeclarity.com',
    'http://localhost:3000'
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-admin-key'],
  credentials: true
}));

/* =========================
   MIDDLEWARE
========================= */
app.use(express.json());

/* =========================
   API ROUTES
========================= */
app.use('/api/v1/auth', require('./routes/auth'));
app.use('/api/v1/decisions', require('./routes/decisions'));
app.use('/api/v1/insights', require('./routes/insights'));
app.use('/api/v1/invite', require('./routes/invite'));

/* =========================
   STATIC FILES
========================= */
app.use(express.static(path.join(__dirname, 'public')));

/* =========================
   SAFE CATCH-ALL
========================= */
app.get(/^\/(?!api).*/, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

/* =========================
   START SERVER
========================= */
const PORT = process.env.PORT || 10000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});