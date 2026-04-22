const express = require('express');
const path = require('path');
const app = express();

app.use(express.json());

/* =========================
   API ROUTES FIRST
========================= */
app.use('/api/v1/auth', require('./routes/auth'));
app.use('/api/v1/decisions', require('./routes/decisions'));
app.use('/api/v1/insights', require('./routes/insights'));

/* =========================
   STATIC FILES
========================= */
app.use(express.static(path.join(__dirname, 'public')));

/* =========================
   CATCH-ALL (FIXED)
   ONLY for non-API routes
========================= */
app.get(/^\/(?!api).*/, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

/* =========================
   START SERVER
========================= */
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`API running on port ${PORT}`);
});