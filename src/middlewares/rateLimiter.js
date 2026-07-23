import rateLimit from "express-rate-limit";

export const otpVerifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 attempts per windowMs
  message: {
    success: false,
    error_code: "TOO_MANY_ATTEMPTS",
    message: "Too many verification attempts. Please try again after 15 minutes.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

export const deviceLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 3, // Limit each IP/device to 3 attempts per windowMs
  keyGenerator: (req) => {
    // If device_id is provided in the request body, use it as the unique key.
    // Otherwise, fall back to the client's IP.
    return req.body?.device_id || req.ip;
  },
  message: {
    success: false,
    error_code: "TOO_MANY_ATTEMPTS",
    message: "Too many login attempts. Please try again after 15 minutes.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

export const deviceVerifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 15, // Limit each IP to 15 attempts per windowMs
  message: {
    success: false,
    error_code: "TOO_MANY_ATTEMPTS",
    message: "Too many verification attempts. Please try again after 15 minutes.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

