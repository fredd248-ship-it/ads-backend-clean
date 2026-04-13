const jwt = require("jsonwebtoken");

module.exports = (req, res, next) => {
  try {
    // 🔍 DEBUG — REMOVE LATER
    console.log("AUTH HEADER:", req.headers.authorization);

    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({
        success: false,
        error: "No token provided"
      });
    }

    const parts = authHeader.split(" ");

    if (parts.length !== 2 || parts[0] !== "Bearer") {
      return res.status(401).json({
        success: false,
        error: "Invalid authorization format"
      });
    }

    const token = parts[1];

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // 🔴 CRITICAL — attach user to request
    req.user = decoded;

    next();

  } catch (err) {
    console.error("AUTH ERROR:", err.message);

    return res.status(401).json({
      success: false,
      error: "Invalid token"
    });
  }
};