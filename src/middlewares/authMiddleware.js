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

    // ✅ Re-check live account state on every request
    const owner = await prisma.owner.findUnique({
      where: { owner_id: decoded.owner_id },
      select: {
        owner_id: true,
        status: true,
        trial_expires_at: true,
        subscription_expires_at: true,
        package_id: true,
        package: { select: { package_key: true } },
      },
    });

    if (!owner) {
      return res.status(401).json({ success: false, error_code: "OWNER_NOT_FOUND", message: "Account not found." });
    }

    // Trial expiry check
    // Trial expiry / pending-payment check
    if (owner.status === "trial") {
      const pendingPayment = await prisma.paymentProof.findFirst({
        where: { owner_id: owner.owner_id, status: "pending" },
        select: { id: true },
      });

      if (pendingPayment) {
        return res.status(403).json({
          success: false,
          error_code: "PAYMENT_PENDING",
          message: "Your payment proof is under review. Please wait for approval.",
        });
      }

      if (owner.trial_expires_at && new Date() > new Date(owner.trial_expires_at)) {
        return res.status(403).json({
          success: false,
          error_code: "TRIAL_EXPIRED",
          message: "Your 30-day trial has expired. Please subscribe to continue.",
        });
      }
    }

    // Active subscription expiry check
    if (owner.status === "active") {
      if (
        owner.subscription_expires_at &&
        new Date(owner.subscription_expires_at) < new Date()
      ) {
        return res.status(403).json({
          success: false,
          error_code: "SUBSCRIPTION_EXPIRED",
          message: "Your subscription has expired. Please renew to continue.",
        });
      }
    }

    // Inactive account check
    if (owner.status === "inactive") {
      return res.status(403).json({
        success: false,
        error_code: "ACCOUNT_INACTIVE",
        message: "Your account is inactive. Please contact support or renew your subscription.",
      });
    }

    req.owner = {
      owner_id: owner.owner_id,
      email: decoded.email,
      package_id: owner.package_id,
      package_key: owner.package?.package_key ?? decoded.package_key,
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
