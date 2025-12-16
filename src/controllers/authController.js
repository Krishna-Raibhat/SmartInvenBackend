const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { Op } = require("sequelize");

const Owner = require("../models/Owner");
const PasswordResetOtp = require("../models/PasswordResetOtp");
const { sendOtpEmail } = require("../utils/mailer");

/* =========================
   Helpers
========================= */

const sendError = (res, status, error_code, message, extra = {}) => {
  return res.status(status).json({
    success: false,
    error_code,
    message,
    ...extra,
  });
};

const sendSuccess = (res, status, data) => {
  return res.status(status).json({
    success: true,
    ...data,
  });
};

const normalizeEmail = (email) =>
  String(email || "").trim().toLowerCase();

const generateToken = (owner) => {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET_MISSING");
  }

  return jwt.sign(
    { owner_id: owner.owner_id, email: owner.email },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );
};

const generateOtp = () =>
  String(Math.floor(100000 + Math.random() * 900000)); // 6 digits

const validatePassword = (password) => {
  const errors = [];
  if (typeof password !== "string")
    return ["Password must be a string."];

  if (password.length < 8)
    errors.push("Password must be at least 8 characters.");
  if (!/[A-Z]/.test(password))
    errors.push("Password must contain at least 1 uppercase letter.");
  if (!/[a-z]/.test(password))
    errors.push("Password must contain at least 1 lowercase letter.");
  if (!/[0-9]/.test(password))
    errors.push("Password must contain at least 1 number.");
  if (!/[^A-Za-z0-9]/.test(password))
    errors.push("Password must contain at least 1 special character.");

  return errors;
};

/* =========================
   REGISTER
========================= */
exports.register = async (req, res) => {
  try {
    let { full_name, phone, email, password, confirm_password } = req.body;
    email = normalizeEmail(email);

    if (!full_name || !phone || !email || !password || !confirm_password) {
      return sendError(
        res,
        400,
        "VALIDATION_REQUIRED_FIELDS",
        "All fields are required."
      );
    }

    if (password !== confirm_password) {
      return sendError(
        res,
        400,
        "VALIDATION_PASSWORD_MISMATCH",
        "Password and confirm password do not match."
      );
    }

    const passwordErrors = validatePassword(password);
    if (passwordErrors.length) {
      return sendError(
        res,
        400,
        "VALIDATION_PASSWORD_WEAK",
        "Password is not strong enough.",
        { errors: passwordErrors }
      );
    }

    const emailExists = await Owner.findOne({ where: { email } });
    if (emailExists) {
      return sendError(
        res,
        409,
        "EMAIL_ALREADY_EXISTS",
        "Email is already registered."
      );
    }

    const phoneExists = await Owner.findOne({ where: { phone } });
    if (phoneExists) {
      return sendError(
        res,
        409,
        "PHONE_ALREADY_EXISTS",
        "Phone number is already registered."
      );
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const owner = await Owner.create({
      full_name,
      phone,
      email,
      password: hashedPassword,
    });

    const token = generateToken(owner);

    return sendSuccess(res, 201, {
      message: "Owner registered successfully.",
      token,
      owner: {
        owner_id: owner.owner_id,
        full_name: owner.full_name,
        email: owner.email,
        phone: owner.phone,
      },
    });
  } catch (err) {
    console.error("Register error:", err);

  // Sequelize validation errors (like invalid email)
  if (err.name === "SequelizeValidationError") {
    return sendError(
      res,
      400,
      "VALIDATION_ERROR",
      "Invalid input.",
      { errors: err.errors.map(e => e.message) }
    );
  }

  // Sequelize unique constraint errors
  if (err.name === "SequelizeUniqueConstraintError") {
    return sendError(
      res,
      409,
      "DUPLICATE_VALUE",
      "Email or phone already exists.",
      { errors: err.errors.map(e => e.message) }
    );
  }

  return sendError(res, 500, "SERVER_ERROR", "Registration failed.");
  }
};

/* =========================
   LOGIN
========================= */
exports.login = async (req, res) => {
  try {
    let { email, password } = req.body;
    email = normalizeEmail(email);

    if (!email || !password) {
      return sendError(
        res,
        400,
        "VALIDATION_REQUIRED_FIELDS",
        "Email and password are required."
      );
    }

    const owner = await Owner.findOne({ where: { email } });
    if (!owner) {
      return sendError(
        res,
        401,
        "INVALID_CREDENTIALS",
        "Invalid email or password."
      );
    }

    const isMatch = await bcrypt.compare(password, owner.password);
    if (!isMatch) {
      return sendError(
        res,
        401,
        "INVALID_CREDENTIALS",
        "Invalid email or password."
      );
    }

    const token = generateToken(owner);

    return sendSuccess(res, 200, {
      message: "Login successful.",
      token,
      owner: {
        owner_id: owner.owner_id,
        full_name: owner.full_name,
        email: owner.email,
        phone: owner.phone,
      },
    });
  } catch (err) {
    console.error(err);
    return sendError(res, 500, "SERVER_ERROR", "Login failed.");
  }
};

/* =========================
   ME
========================= */
exports.me = async (req, res) => {
  try {
    const ownerId = req.owner?.owner_id;
    if (!ownerId) {
      return sendError(res, 401, "AUTH_UNAUTHORIZED", "Unauthorized.");
    }

    const owner = await Owner.findByPk(ownerId, {
      attributes: ["owner_id", "full_name", "email", "phone", "created_at"],
    });

    if (!owner) {
      return sendError(res, 404, "OWNER_NOT_FOUND", "Owner not found.");
    }

    return sendSuccess(res, 200, { owner });
  } catch (err) {
    console.error(err);
    return sendError(res, 500, "SERVER_ERROR", "Failed to fetch profile.");
  }
};

/* =========================
   UPDATE PROFILE
========================= */
exports.updateMe = async (req, res) => {
  try {
    const ownerId = req.owner?.owner_id;
    const { full_name, phone, email } = req.body;
    const normalizedEmail = email ? normalizeEmail(email) : null;

    if (!full_name && !phone && !email) {
      return sendError(
        res,
        400,
        "VALIDATION_NO_FIELDS",
        "At least one field is required."
      );
    }

    const owner = await Owner.findByPk(ownerId);
    if (!owner) {
      return sendError(res, 404, "OWNER_NOT_FOUND", "Owner not found.");
    }

    if (normalizedEmail && normalizedEmail !== owner.email) {
      const emailExists = await Owner.findOne({
        where: {
          email: normalizedEmail,
          owner_id: { [Op.ne]: ownerId },
        },
      });
      if (emailExists) {
        return sendError(
          res,
          409,
          "EMAIL_ALREADY_IN_USE",
          "Email already in use."
        );
      }
      owner.email = normalizedEmail;
    }

    if (phone && phone !== owner.phone) {
      const phoneExists = await Owner.findOne({
        where: { phone, owner_id: { [Op.ne]: ownerId } },
      });
      if (phoneExists) {
        return sendError(
          res,
          409,
          "PHONE_ALREADY_IN_USE",
          "Phone already in use."
        );
      }
      owner.phone = phone;
    }

    if (full_name) owner.full_name = full_name;

    await owner.save();
    const token = generateToken(owner);

    return sendSuccess(res, 200, {
      message: "Profile updated.",
      token,
      owner,
    });
  } catch (err) {
    console.error(err);
    return sendError(res, 500, "SERVER_ERROR", "Profile update failed.");
  }
};

/* =========================
   CHANGE PASSWORD
========================= */
exports.changePassword = async (req, res) => {
  try {
    const ownerId = req.owner?.owner_id;
    const { old_password, new_password, confirm_password } = req.body;

    if (!old_password || !new_password || !confirm_password) {
      return sendError(
        res,
        400,
        "VALIDATION_REQUIRED_FIELDS",
        "All fields are required."
      );
    }

    if (new_password !== confirm_password) {
      return sendError(
        res,
        400,
        "VALIDATION_PASSWORD_MISMATCH",
        "Passwords do not match."
      );
    }

    const passwordErrors = validatePassword(new_password);
    if (passwordErrors.length) {
      return sendError(
        res,
        400,
        "VALIDATION_PASSWORD_WEAK",
        "Password is not strong enough.",
        { errors: passwordErrors }
      );
    }

    const owner = await Owner.findByPk(ownerId);
    if (!owner) {
      return sendError(res, 404, "OWNER_NOT_FOUND", "Owner not found.");
    }

    const isOldMatch = await bcrypt.compare(old_password, owner.password);
    if (!isOldMatch) {
      return sendError(
        res,
        401,
        "OLD_PASSWORD_INCORRECT",
        "Old password is incorrect."
      );
    }

    const sameAsOld = await bcrypt.compare(new_password, owner.password);
    if (sameAsOld) {
      return sendError(
        res,
        400,
        "PASSWORD_SAME_AS_OLD",
        "New password must be different."
      );
    }

    owner.password = await bcrypt.hash(new_password, 10);
    await owner.save();

    return sendSuccess(res, 200, {
      message: "Password changed successfully.",
    });
  } catch (err) {
    console.error(err);
    return sendError(res, 500, "SERVER_ERROR", "Password change failed.");
  }
};


// POST /api/auth/forgot-password
exports.forgotPasswordSendOtp = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: "Email is required." });

    const owner = await Owner.findOne({ where: { email } });

    // Security best practice: don't reveal whether email exists
    if (!owner) {
      return res.status(200).json({ message: "If the email exists, an OTP has been sent." });
    }

    // Check lock
    const activeRecord = await PasswordResetOtp.findOne({
      where: { owner_id: owner.owner_id },
      order: [["created_at", "DESC"]],
    });

    const now = new Date();

    if (activeRecord?.locked_until && activeRecord.locked_until > now) {
      return res.status(423).json({
        message: "Account is locked due to too many wrong OTP attempts. Try later.",
        locked_until: activeRecord.locked_until,
      });
    }

    // Optional resend throttle (recommended): allow resend after 30 sec
    if (activeRecord?.last_sent_at) {
      const seconds = (now - new Date(activeRecord.last_sent_at)) / 1000;
      if (seconds < 30) {
        return res.status(429).json({
          message: "Please wait before requesting another OTP.",
        });
      }
    }

    const otp = generateOtp();
    const otpHash = await bcrypt.hash(otp, 10);

    const expiresAt = new Date(Date.now() + 2 * 60 * 1000); // 2 minutes

    // Invalidate previous OTPs by creating a new row (simple + auditable)
    await PasswordResetOtp.create({
      owner_id: owner.owner_id,
      email: owner.email,
      otp_hash: otpHash,
      expires_at: expiresAt,
      wrong_attempts: 0,
      locked_until: null,
      last_sent_at: now,
      verified_at: null,
    });

    await sendOtpEmail({ to: owner.email, otp });

    return res.status(200).json({ message: "OTP sent to email." });
  } catch (error) {
     console.error("forgotPasswordReset error:", error);

  if (error.name === "JsonWebTokenError") {
    return sendError(res, 401, "RESET_TOKEN_INVALID", "Reset token is invalid.");
  }
  if (error.name === "TokenExpiredError") {
    return sendError(res, 401, "RESET_TOKEN_EXPIRED", "Reset token has expired.");
  }

  return sendError(res, 500, "SERVER_ERROR", "Server error.");
  }
};

// POST /api/auth/forgot-password/verify-otp
exports.forgotPasswordVerifyOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) {
      return res.status(400).json({ message: "Email and OTP are required." });
    }

    const owner = await Owner.findOne({ where: { email } });
    // same anti-enum behavior
    if (!owner) return res.status(401).json({ message: "Invalid OTP." });

    const record = await PasswordResetOtp.findOne({
      where: { owner_id: owner.owner_id },
      order: [["created_at", "DESC"]],
    });

    if (!record) return res.status(401).json({ message: "Invalid OTP." });

    const now = new Date();

    if (record.locked_until && record.locked_until > now) {
      return res.status(423).json({
        message: "Account is locked. Try later.",
        locked_until: record.locked_until,
      });
    }

    if (record.expires_at <= now) {
      return res.status(400).json({ message: "OTP expired. Please request a new OTP." });
    }

    const isMatch = await bcrypt.compare(String(otp), record.otp_hash);

    if (!isMatch) {
      const newAttempts = record.wrong_attempts + 1;

      // Lock for 5 hours if attempts reach 3
      if (newAttempts >= 3) {
        const lockedUntil = new Date(Date.now() + 5 * 60 * 60 * 1000);
        record.wrong_attempts = newAttempts;
        record.locked_until = lockedUntil;
        await record.save();

        return res.status(423).json({
          message: "Too many wrong OTP attempts. Account locked for 5 hours.",
          locked_until: lockedUntil,
        });
      }

      record.wrong_attempts = newAttempts;
      await record.save();

      return res.status(401).json({
        message: "Invalid OTP.",
        remaining_attempts: 3 - newAttempts,
      });
    }

    record.verified_at = now;
    await record.save();

    // Return a short-lived reset token (JWT) to allow password reset step securely
    // This avoids trusting just "email" for reset.
    const resetToken = require("jsonwebtoken").sign(
      { owner_id: owner.owner_id, purpose: "reset_password" },
      process.env.JWT_SECRET,
      { expiresIn: "10m" }
    );

    return res.status(200).json({
      message: "OTP verified.",
      reset_token: resetToken,
    });
  } catch (error) {
    console.error("forgotPasswordVerifyOtp error:", error);
    return res.status(500).json({ message: "Server error." });
  }
};

// POST /api/auth/forgot-password/reset
exports.forgotPasswordReset = async (req, res) => {
  try {
    const { reset_token, new_password, confirm_password } = req.body;

    if (!reset_token || !new_password || !confirm_password) {
      return res.status(400).json({
        message: "reset_token, new_password and confirm_password are required.",
      });
    }

    if (new_password !== confirm_password) {
      return res.status(400).json({ message: "Passwords do not match." });
    }

    const passwordErrors = validatePassword(new_password);
    if (passwordErrors.length) {
      return res.status(400).json({
        message: "New password is not strong enough.",
        errors: passwordErrors,
      });
    }

    const jwt = require("jsonwebtoken");
    const decoded = jwt.verify(reset_token, process.env.JWT_SECRET);

    if (decoded.purpose !== "reset_password") {
      return res.status(401).json({ message: "Invalid reset token." });
    }

    const owner = await Owner.findByPk(decoded.owner_id);
    if (!owner) return res.status(404).json({ message: "Owner not found." });

    const hashed = await bcrypt.hash(new_password, 10);
    owner.password = hashed; // maps to password_hash
    await owner.save();

    return res.status(200).json({ message: "Password reset successful. Please login." });
  } catch (error) {
    console.error("forgotPasswordReset error:", error);
    return res.status(500).json({ message: "Server error." });
  }
};
