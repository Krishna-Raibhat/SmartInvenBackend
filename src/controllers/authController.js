const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const Owner = require("../models/Owner");
const { Op } = require("sequelize");
const PasswordResetOtp = require("../models/PasswordResetOtp");
const { sendOtpEmail } = require("../utils/mailer");

const generateOtp = () => String(Math.floor(100000 + Math.random() * 900000)); // 6 digits

// token helper
const generateToken = (owner) => {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET is not set in environment");
  }

  return jwt.sign(
    {
      owner_id: owner.owner_id,
      email: owner.email,
    },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );
};

const validatePassword = (password) => {
  const errors = [];

  if (typeof password !== "string") {
    return ["Password must be a string."];
  }

  if (password.length < 8) errors.push("Password must be at least 8 characters.");
  if (!/[A-Z]/.test(password)) errors.push("Password must contain at least 1 uppercase letter.");
  if (!/[a-z]/.test(password)) errors.push("Password must contain at least 1 lowercase letter.");
  if (!/[0-9]/.test(password)) errors.push("Password must contain at least 1 number.");
  if (!/[^A-Za-z0-9]/.test(password)) errors.push("Password must contain at least 1 special character.");

  return errors;
};
// POST /api/auth/register
exports.register = async (req, res) => {
  try {
    const { full_name, phone, email, password, confirm_password } = req.body;

    // Basic validation
    if (!full_name || !phone || !email || !password || !confirm_password) {
      return res.status(400).json({
        message: "full_name, phone, email, password and confirm_password are required.",
      });
    }

    // Confirm password check (not stored in DB)
    if (password !== confirm_password) {
      return res.status(400).json({
        message: "Password and confirm_password do not match.",
      });
    }

    // Password strength validation
    const passwordErrors = validatePassword(password);
    if (passwordErrors.length > 0) {
      return res.status(400).json({
        message: "Password is not strong enough.",
        errors: passwordErrors,
      });
    }

    // Check existing owner by email
    const existingEmail = await Owner.findOne({ where: { email } });
    if (existingEmail) {
      return res.status(409).json({ message: "Owner with this email already exists." });
    }

    // Check existing owner by phone
    const existingPhone = await Owner.findOne({ where: { phone } });
    if (existingPhone) {
      return res.status(409).json({ message: "Owner with this phone already exists." });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create owner
    const owner = await Owner.create({
      full_name,
      phone,
      email,
      password: hashedPassword, // maps to DB column password_hash
    });

    const token = generateToken(owner);

    return res.status(201).json({
      message: "Owner registered successfully",
      token,
      owner: {
        owner_id: owner.owner_id,
        full_name: owner.full_name,
        email: owner.email,
        phone: owner.phone,
      },
    });
  } catch (error) {
    console.error("Server error during owner registration:", error);
    return res.status(500).json({ message: "Server error during registration" });
  }
};

// POST /api/auth/login
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res
        .status(400)
        .json({ message: "Email and password are required." });
    }

    const owner = await Owner.findOne({ where: { email } });

    if (!owner) {
      return res.status(401).json({ message: "Invalid email or password." });
    }

    // owner.password contains hashed password (db column password_hash)
    const isMatch = await bcrypt.compare(password, owner.password);

    if (!isMatch) {
      return res.status(401).json({ message: "Invalid email or password." });
    }

    const token = generateToken(owner);

    return res.status(200).json({
      message: "Login successful",
      token,
      owner: {
        owner_id: owner.owner_id,
        full_name: owner.full_name,
        email: owner.email,
        phone: owner.phone,
      },
    });
  } catch (error) {
    console.error("Server error during owner login:", error);
    return res.status(500).json({ message: "Server error during login" });
  }
};

// GET /api/auth/me (protected)
exports.me = async (req, res) => {
  try {
    // expected: auth middleware sets req.owner from token
    const ownerId = req.owner?.owner_id;

    if (!ownerId) {
      return res.status(401).json({ message: "Unauthorized." });
    }

    const owner = await Owner.findByPk(ownerId, {
      attributes: ["owner_id", "full_name", "email", "phone", "created_at"],
    });

    if (!owner) {
      return res.status(404).json({ message: "Owner not found." });
    }

    return res.status(200).json({ owner });
  } catch (error) {
    console.error("Server error during me:", error);
    return res.status(500).json({ message: "Server error" });
  }
};



// PUT /api/auth/me
exports.updateMe = async (req, res) => {
  try {
    // set by authMiddleware
    const { owner_id } = req.owner;

    const { full_name, phone, email } = req.body;

    if (!full_name && !phone && !email) {
      return res.status(400).json({
        message:
          "At least one field (full_name, phone, email) is required to update.",
      });
    }

    // Find owner
    const owner = await Owner.findByPk(owner_id);

    if (!owner) {
      return res.status(404).json({ message: "Owner not found." });
    }

    // Check email uniqueness
    if (email && email !== owner.email) {
      const existingEmail = await Owner.findOne({
        where: {
          email,
          owner_id: { [Op.ne]: owner_id },
        },
      });

      if (existingEmail) {
        return res
          .status(409)
          .json({ message: "Email is already in use." });
      }

      owner.email = email;
    }

    // Check phone uniqueness
    if (phone && phone !== owner.phone) {
      const existingPhone = await Owner.findOne({
        where: {
          phone,
          owner_id: { [Op.ne]: owner_id },
        },
      });

      if (existingPhone) {
        return res
          .status(409)
          .json({ message: "Phone is already in use." });
      }

      owner.phone = phone;
    }

    // Update full name
    if (full_name) {
      owner.full_name = full_name;
    }

    await owner.save();

    // Re-issue token (important if email changed)
    const token = jwt.sign(
      {
        owner_id: owner.owner_id,
        email: owner.email,
      },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    return res.status(200).json({
      message: "Profile updated successfully.",
      token,
      owner: {
        owner_id: owner.owner_id,
        full_name: owner.full_name,
        email: owner.email,
        phone: owner.phone,
        created_at: owner.created_at,
        updated_at: owner.updated_at,
      },
    });
  } catch (error) {
    console.error("Server error in updateMe:", error);
    return res.status(500).json({ message: "Server error." });
  }
};


// PUT /api/auth/change-password (protected)
exports.changePassword = async (req, res) => {
  try {
    const ownerId = req.owner?.owner_id;
    if (!ownerId) {
      return res.status(401).json({ message: "Unauthorized." });
    }

    const { old_password, new_password, confirm_password } = req.body;

    if (!old_password || !new_password || !confirm_password) {
      return res.status(400).json({
        message: "old_password, new_password, and confirm_password are required.",
      });
    }

    if (new_password !== confirm_password) {
      return res.status(400).json({
        message: "new_password and confirm_password do not match.",
      });
    }

    // Validate new password strength
    const passwordErrors = validatePassword(new_password);
    if (passwordErrors.length > 0) {
      return res.status(400).json({
        message: "New password is not strong enough.",
        errors: passwordErrors,
      });
    }

    const owner = await Owner.findByPk(ownerId);
    if (!owner) {
      return res.status(404).json({ message: "Owner not found." });
    }

    // Check old password
    const isOldMatch = await bcrypt.compare(old_password, owner.password);
    if (!isOldMatch) {
      return res.status(401).json({ message: "Old password is incorrect." });
    }

    // Prevent setting same password again
    const isSameAsOld = await bcrypt.compare(new_password, owner.password);
    if (isSameAsOld) {
      return res.status(400).json({ message: "New password must be different from old password." });
    }

    // Hash and save new password
    const hashed = await bcrypt.hash(new_password, 10);
    owner.password = hashed; // maps to password_hash
    await owner.save();

    return res.status(200).json({ message: "Password changed successfully." });
  } catch (error) {
    console.error("Server error in changePassword:", error);
    return res.status(500).json({ message: "Server error." });
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
    console.error("forgotPasswordSendOtp error:", error);
    return res.status(500).json({ message: "Server error." });
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
