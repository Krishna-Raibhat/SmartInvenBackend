import jwt from "jsonwebtoken";
import { prisma } from "../prisma/client.js";

export default async (req, res, next) => {
  try {
    const authHeader = req.headers["authorization"];

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ success: false, error_code: "NO_TOKEN", message: "No token provided." });
    }

    if (!process.env.JWT_SECRET) {
      console.error("JWT_SECRET is not set in environment");
      return res.status(500).json({ success: false, error_code: "SERVER_CONFIG_ERROR", message: "Server config error." });
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // ✅ Super admin — skip DB lookup
    if (decoded?.role === "superadmin") {
      req.superAdmin = { email: decoded.email, role: decoded.role };
      return next();
    }

    if (!decoded?.owner_id) {
      return res.status(401).json({ success: false, error_code: "INVALID_TOKEN", message: "Invalid token payload." });
    }

    req.owner = {
      owner_id: decoded.owner_id,
      email: decoded.email,
      package_id: decoded.package_id,
      package_key: decoded.package_key,
    };
    next();
  } catch (err) {
    console.error("Auth middleware error:", err.name, err.message);
    if (err.name === "TokenExpiredError") {
      return res.status(401).json({ success: false, error_code: "TOKEN_EXPIRED", message: "Token expired. Please login again." });
    }
    return res.status(401).json({ success: false, error_code: "TOKEN_INVALID", message: "Invalid token." });
  }
};
