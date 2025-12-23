const jwt = require("jsonwebtoken");
const prisma = require("../prisma/client"); // adjust path if different

module.exports = async (req, res, next) => {
  try {
    const authHeader = req.headers["authorization"]; // "Bearer <token>"

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        error_code: "NO_TOKEN",
        message: "No token provided.",
      });
    }

    if (!process.env.JWT_SECRET) {
      console.error("JWT_SECRET is not set in environment");
      return res.status(500).json({
        success: false,
        error_code: "SERVER_CONFIG_ERROR",
        message: "Server config error.",
      });
    }

    const token = authHeader.split(" ")[1];

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    // expected decoded: { owner_id, email, package_id?, iat, exp }

    if (!decoded?.owner_id) {
      return res.status(401).json({
        success: false,
        error_code: "INVALID_TOKEN",
        message: "Invalid token payload.",
      });
    }

    // ✅ Load owner from DB (Prisma)
    const owner = await prisma.owner.findUnique({
      where: { owner_id: decoded.owner_id },
      select: {
        owner_id: true,
        full_name: true,
        email: true,
        phone: true,
        package_id: true,
      },
    });

    if (!owner) {
      return res.status(401).json({
        success: false,
        error_code: "OWNER_NOT_FOUND",
        message: "Owner not found. Please login again.",
      });
    }

    // attach real owner object (not only token payload)
    req.owner = owner;

    next();
  } catch (err) {
    console.error("Auth middleware error:", err);

    return res.status(401).json({
      success: false,
      error_code: "TOKEN_INVALID_OR_EXPIRED",
      message: "Invalid or expired token.",
    });
  }
};
