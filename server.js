const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();

/* =========================
   CORS (CRITICAL FIX)
========================= */
app.use(cors({
  origin: [
    'https://outcomeclarity.com',
    'http://localhost:3000'
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

/* handle preflight explicitly */
app.options('*', cors());

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

/* =========================
   STATIC FILES
========================= */
app.use(express.static(path.join(__dirname, 'public')));

/* =========================
   SAFE CATCH-ALL (NON-API ONLY)
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