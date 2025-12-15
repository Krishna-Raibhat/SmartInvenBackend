const jwt = require("jsonwebtoken");

module.exports = (req, res, next) => {
  const authHeader = req.headers["authorization"]; // "Bearer <token>"

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "No token provided." });
  }

  const token = authHeader.split(" ")[1];

  if (!process.env.JWT_SECRET) {
    console.error("JWT_SECRET is not set in environment");
    return res.status(500).json({ message: "Server config error." });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    // decoded should be: { owner_id, email, iat, exp }
    req.owner = decoded;
    next();
  } catch (err) {
    console.error("Auth middleware error:", err);
    return res.status(401).json({ message: "Invalid or expired token." });
  }
};
