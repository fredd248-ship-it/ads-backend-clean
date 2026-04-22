const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();

/* =========================
   CORS (FIXED)
========================= */
const corsOptions = {
  origin: [
    'https://outcomeclarity.com',
    'http://localhost:3000'
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
};

app.use(cors(corsOptions));

/* IMPORTANT: handle preflight WITHOUT '*' */
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', 'https://outcomeclarity.com');
  res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }

  next();
});

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