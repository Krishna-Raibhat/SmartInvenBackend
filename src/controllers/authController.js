
import { hash, compare } from "bcrypt";
import jwt from "jsonwebtoken";


import { prisma } from "../prisma/client.js";
// adjust path if needed
import { sendOtpEmail, sendRegistrationOtpEmail } from "../utils/mailer.js";


const { sign, verify } = jwt;

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
  String(email || "")
    .trim()
    .toLowerCase();

const generateToken = (payload) => {
  if (!process.env.JWT_SECRET) throw new Error("JWT_SECRET_MISSING");

  return sign(
    {
      owner_id: payload.owner_id,
      email: payload.email,
      package_id: payload.package_id,
      package_key: payload.package_key, 
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
  );
};

const generateOtp = () => String(Math.floor(100000 + Math.random() * 900000)); // 6 digits

// ================= EMAIL VALIDATION =================
const validateEmail = (email) => {
  if (typeof email !== "string") return "Email must be a string.";

  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[A-Za-z]{2,}$/;

  if (!emailRegex.test(email)) {
    return "Invalid email address format.";
  }

  return null;
};

const validatePassword = (password) => {
  const errors = [];
  if (typeof password !== "string") return ["Password must be a string."];

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

const validatePhone = (phone) => {
  if (typeof phone !== "string") return "Phone must be a string.";
  if (!/^\d{10}$/.test(phone)) return "Phone number must be exactly 10 digits.";
  return null;
};

const packageNameMap = {
  hardware: "Hardware Store",
  clothing: "Clothing Store",
  grocery: "Grocery Store",
  store: "Store",
};

export async function register(req, res) {
  try {
    let { full_name, phone, email, password, confirm_password, package_key, status } = req.body;

    email = normalizeEmail(email);
    package_key = String(package_key || "").trim().toLowerCase();

    if (!full_name || !phone || !email || !password || !confirm_password || !package_key) {
      return sendError(res, 400, "VALIDATION_REQUIRED_FIELDS", "All fields are required.");
    }

    // ✅ allow only these packages
    const allowed = new Set(["hardware", "clothing", "grocery", "store"]);
    if (!allowed.has(package_key)) {
      return sendError(res, 400, "VALIDATION_PACKAGE_INVALID", "Invalid package_key.");
    }

    // ✅ validate status if provided
    const validStatuses = ["trial", "active", "inactive"];
    if (status && !validStatuses.includes(status)) {
      return sendError(res, 400, "VALIDATION_STATUS_INVALID", "Invalid status. Must be one of: trial, active, inactive.");
    }

    const emailError = validateEmail(email);
    if (emailError) return sendError(res, 400, "VALIDATION_EMAIL_INVALID", emailError);

    const phoneError = validatePhone(phone);
    if (phoneError) return sendError(res, 400, "VALIDATION_PHONE_INVALID", phoneError);

    if (password !== confirm_password) {
      return sendError(res, 400, "VALIDATION_PASSWORD_MISMATCH", "Password and confirm password do not match.");
    }

    const passwordErrors = validatePassword(password);
    if (passwordErrors.length) {
      return sendError(res, 400, "VALIDATION_PASSWORD_WEAK", "Password is not strong enough.", { errors: passwordErrors });
    }

    const emailExists = await prisma.owner.findUnique({ where: { email } });
    if (emailExists) return sendError(res, 409, "EMAIL_ALREADY_EXISTS", "Email is already registered.");

    const phoneExists = await prisma.owner.findUnique({ where: { phone } });
    if (phoneExists) return sendError(res, 409, "PHONE_ALREADY_EXISTS", "Phone number is already registered.");

    const hashedPassword = await hash(password, 10);

    // ✅ Validation passed - Generate and send OTP
    const otp = generateOtp();
    const otpHash = await hash(otp, 10);
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    // Store OTP with registration data
    await prisma.registrationOtp.create({
      data: {
        email,
        otp_hash: otpHash,
        expires_at: expiresAt,
        wrong_attempts: 0,
        locked_until: null,
        last_sent_at: new Date(),
        verified_at: null,
        // Store registration data temporarily
        full_name,
        phone,
        password_hash: hashedPassword,
        package_key,
      },
    });

    // Send OTP email
    await sendRegistrationOtpEmail({ to: email, otp });

    return sendSuccess(res, 200, {
      message: "Registration data validated. OTP sent to email.",
      requires_verification: true,
      expires_in: 300,
    });
  } catch (err) {
    console.error("Register error:", err);
    if (err.code === "P2002") {
      return sendError(res, 409, "DUPLICATE_VALUE", "Email or phone already exists.");
    }
    return sendError(res, 500, "SERVER_ERROR", "Registration failed.", {
      detail: err?.message ?? "An unexpected error occurred.",
    });
  }
}


/* =========================
   LOGIN
========================= */
export async function login(req, res) {
  try {
    let { email, password, fcm_token } = req.body;
    email = normalizeEmail(email);

    if (!email || !password) {
      return sendError(
        res,
        400,
        "VALIDATION_REQUIRED_FIELDS",
        "Email and password are required.",
      );
    }

    const owner = await prisma.owner.findUnique({
      where: { email },
      select: {
        owner_id: true,
        full_name: true,
        email: true,
        phone: true,
        package_id: true,
        password: true,
        status: true,
        created_at: true,
        subscription_expires_at: true,
        package: { select: { package_key: true, package_name: true } },
      },
    });

    if (!owner) {
      return sendError(
        res,
        401,
        "INVALID_CREDENTIALS",
        "Invalid email or password.",
      );
    }

    const isMatch = await compare(password, owner.password);
    if (!isMatch) {
      return sendError(
        res,
        401,
        "INVALID_CREDENTIALS",
        "Invalid email or password.",
      );
    }

    // ✅ Check account status
    // --------------------------------------------------
    // CHECK PENDING PAYMENT FIRST
    // --------------------------------------------------
    if (owner.status === "inactive") {
      const pendingPayment = await prisma.paymentProof.findFirst({
        where: {
          owner_id: owner.owner_id,
          status: "pending",
        },
      });

      if (pendingPayment) {
        return sendError(
          res,
          403,
          "PAYMENT_PENDING",
          "Your payment proof is under review. Please wait for approval.",
          {
            owner: {
              owner_id: owner.owner_id,
              full_name: owner.full_name,
              email: owner.email,
              phone: owner.phone,
              package_id: owner.package_id,
              status: owner.status,
              package_key: owner.package?.package_key ?? null,
              package_name: owner.package?.package_name ?? null,
            },
          },
        );
      }

      if (
        owner.subscription_expires_at &&
        new Date(owner.subscription_expires_at) < new Date()
      ) {
        return sendError(
          res,
          403,
          "SUBSCRIPTION_EXPIRED",
          "Your subscription has expired. Please renew to continue.",
          {
            owner: {
              owner_id: owner.owner_id,
              full_name: owner.full_name,
              email: owner.email,
              phone: owner.phone,
              package_id: owner.package_id,
              status: owner.status,
              package_key: owner.package?.package_key ?? null,
              package_name: owner.package?.package_name ?? null,
            },
          },
        );
      }
    }
    if (owner.status === "trial") {
      const trialExpiry = new Date(new Date(owner.created_at).getTime() + 7 * 24 * 60 * 60 * 1000);

      if (new Date() > trialExpiry) {
        const pendingPayment = await prisma.paymentProof.findFirst({
          where: { owner_id: owner.owner_id, status: "pending" },
          select: { id: true },
        });

        if (pendingPayment) {
          return sendError(
            res,
            403,
            "TRIAL_EXPIRED",
            "Your payment is still in verification. Please wait for approval or upload a new payment receipt if needed.",
            {
              owner: {
                owner_id: owner.owner_id,
                full_name: owner.full_name,
                email: owner.email,
                phone: owner.phone,
                package_id: owner.package_id,
                status: owner.status,
                package_key: owner.package?.package_key ?? null,
                package_name: owner.package?.package_name ?? null,
              },
              can_update_payment: true,
              payment_status: "pending",
              upload_url: "/api/payment-proof",
            },
          );
        }

        return sendError(
          res,
          403,
          "TRIAL_EXPIRED",
          "Your 7-day trial has expired. Please subscribe to continue.",
          {
            owner: {
              owner_id: owner.owner_id,
              full_name: owner.full_name,
              email: owner.email,
              phone: owner.phone,
              package_id: owner.package_id,
              status: owner.status,
              package_key: owner.package?.package_key ?? null,
              package_name: owner.package?.package_name ?? null,
            },
          },
        );
      }
    }
   
    if (fcm_token) {
      await prisma.owner.update({
        where: { owner_id: owner.owner_id },
        data: { fcm_token },
      });
    }

    const token = generateToken({
      owner_id: owner.owner_id,
      email: owner.email,
      package_id: owner.package_id,
      package_key: owner.package?.package_key ?? null,
    });

    return sendSuccess(res, 200, {
      message: "Login successful.",
      token,
      owner: {
        owner_id: owner.owner_id,
        full_name: owner.full_name,
        email: owner.email,
        phone: owner.phone,
        package_id: owner.package_id,
        status: owner.status,
        package_key: owner.package?.package_key ?? null,
        package_name: owner.package?.package_name ?? null,
      },
    });
  } catch (err) {
    console.error(err);
    return sendError(res, 500, "SERVER_ERROR", "Login failed.", {
      detail: err?.message ?? "An unexpected error occurred.",
    });
  }
}


/* =========================
   ME
========================= */
export async function me(req, res) {
  try {
    const ownerId = req.owner?.owner_id;
    if (!ownerId)
      return sendError(res, 401, "AUTH_UNAUTHORIZED", "Unauthorized.");

    const owner = await prisma.owner.findUnique({
      where: { owner_id: ownerId },
      select: {
        owner_id: true,
        full_name: true,
        email: true,
        phone: true,
        status: true,
        created_at: true,
        package_id: true,
        subscription_expires_at:true
      },
    });

    if (!owner)
      return sendError(res, 404, "OWNER_NOT_FOUND", "Owner not found.");

    return sendSuccess(res, 200, { owner });
  } catch (err) {
    console.error(err);
    return sendError(res, 500, "SERVER_ERROR", "Failed to fetch profile.");
  }
}

/* =========================
   UPDATE PROFILE
========================= */
export async function updateMe(req, res) {
  try {
    const ownerId = req.owner?.owner_id;
    if (!ownerId)
      return sendError(res, 401, "AUTH_UNAUTHORIZED", "Unauthorized.");

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

    // Validate email format if provided
    if (normalizedEmail) {
      const emailError = validateEmail(normalizedEmail);
      if (emailError) {
        return sendError(res, 400, "VALIDATION_EMAIL_INVALID", emailError);
      }
    }

    const existingOwner = await prisma.owner.findUnique({
      where: { owner_id: ownerId },
      select: { owner_id: true, email: true, phone: true, package_id: true },
    });

    if (!existingOwner)
      return sendError(res, 404, "OWNER_NOT_FOUND", "Owner not found.");

    // email unique check (if changed)
    if (normalizedEmail && normalizedEmail !== existingOwner.email) {
      const emailExists = await prisma.owner.findFirst({
        where: { email: normalizedEmail, NOT: { owner_id: ownerId } },
        select: { owner_id: true },
      });

      if (emailExists) {
        return sendError(
          res,
          409,
          "EMAIL_ALREADY_IN_USE",
          "Email already in use."
        );
      }
    }

    // phone validate + unique check (if changed)
    if (phone && phone !== existingOwner.phone) {
      const phoneError = validatePhone(phone);
      if (phoneError)
        return sendError(res, 400, "VALIDATION_PHONE_INVALID", phoneError);

      const phoneExists = await prisma.owner.findFirst({
        where: { phone, NOT: { owner_id: ownerId } },
        select: { owner_id: true },
      });

      if (phoneExists) {
        return sendError(
          res,
          409,
          "PHONE_ALREADY_IN_USE",
          "Phone already in use."
        );
      }
    }

    const updatedOwner = await prisma.owner.update({
      where: { owner_id: ownerId },
      data: {
        ...(full_name ? { full_name } : {}),
        ...(normalizedEmail ? { email: normalizedEmail } : {}),
        ...(phone ? { phone } : {}),
      },
      select: {
        owner_id: true,
        full_name: true,
        email: true,
        phone: true,
        package_id: true,
      },
    });

    const token = generateToken(updatedOwner);

    return sendSuccess(res, 200, {
      message: "Profile updated.",
      token,
      owner: updatedOwner,
    });
  } catch (err) {
    console.error(err);

    if (err.code === "P2002") {
      return sendError(
        res,
        409,
        "DUPLICATE_VALUE",
        "Email or phone already exists."
      );
    }

    return sendError(res, 500, "SERVER_ERROR", "Profile update failed.");
  }
}

/* =========================
   CHANGE PASSWORD
========================= */
export async function changePassword(req, res) {
  try {
    const ownerId = req.owner?.owner_id;
    if (!ownerId)
      return sendError(res, 401, "AUTH_UNAUTHORIZED", "Unauthorized.");

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
        {
          errors: passwordErrors,
        }
      );
    }

    const owner = await prisma.owner.findUnique({
      where: { owner_id: ownerId },
      select: { owner_id: true, password: true },
    });

    if (!owner)
      return sendError(res, 404, "OWNER_NOT_FOUND", "Owner not found.");

    const isOldMatch = await compare(old_password, owner.password);
    if (!isOldMatch) {
      return sendError(
        res,
        401,
        "OLD_PASSWORD_INCORRECT",
        "Old password is incorrect."
      );
    }

    const sameAsOld = await compare(new_password, owner.password);
    if (sameAsOld) {
      return sendError(
        res,
        400,
        "PASSWORD_SAME_AS_OLD",
        "New password must be different."
      );
    }

    const hashed = await hash(new_password, 10);

    await prisma.owner.update({
      where: { owner_id: ownerId },
      data: { password: hashed },
    });

    return sendSuccess(res, 200, { message: "Password changed successfully." });
  } catch (err) {
    console.error(err);
    return sendError(res, 500, "SERVER_ERROR", "Password change failed.");
  }
}

/* =========================
   FORGOT PASSWORD: SEND OTP
========================= */
export async function forgotPasswordSendOtp(req, res) {
  try {
    let { email } = req.body;
    email = normalizeEmail(email);

    if (!email)
      return sendError(
        res,
        400,
        "VALIDATION_REQUIRED_FIELDS",
        "Email is required."
      );

    const owner = await prisma.owner.findUnique({
      where: { email },
      select: { owner_id: true, email: true },
    });

    // Security best practice: don't reveal whether email exists
    if (!owner) {
      return res
        .status(200)
        .json({ message: "If the email exists, an OTP has been sent." });
    }

    const activeRecord = await prisma.passwordResetOtp.findFirst({
      where: { owner_id: owner.owner_id },
      orderBy: { created_at: "desc" },
    });

    const now = new Date();

    if (activeRecord?.locked_until && activeRecord.locked_until > now) {
      return res.status(423).json({
        message:
          "Account is locked due to too many wrong OTP attempts. Try later.",
        locked_until: activeRecord.locked_until,
      });
    }

    if (activeRecord?.last_sent_at) {
      const seconds = (now - new Date(activeRecord.last_sent_at)) / 1000;
      if (seconds < 30) {
        return res
          .status(429)
          .json({ message: "Please wait before requesting another OTP." });
      }
    }

    const otp = generateOtp();
    const otpHash = await hash(otp, 10);
    const expiresAt = new Date(Date.now() + 2 * 60 * 1000); // 2 minutes

    await prisma.passwordResetOtp.create({
      data: {
        owner_id: owner.owner_id,
        email: owner.email,
        otp_hash: otpHash,
        expires_at: expiresAt,
        wrong_attempts: 0,
        locked_until: null,
        last_sent_at: now,
        verified_at: null,
      },
    });

    await sendOtpEmail({ to: owner.email, otp });

    return res.status(200).json({ message: "OTP sent to email." });
  } catch (error) {
    console.error("forgotPasswordSendOtp error:", error);
    return sendError(res, 500, "SERVER_ERROR", "Server error.");
  }
}

/* =========================
   FORGOT PASSWORD: VERIFY OTP
========================= */
export async function forgotPasswordVerifyOtp(req, res) {
  try {
    let { email, otp } = req.body;
    email = normalizeEmail(email);

    if (!email || !otp)
      return res.status(400).json({ message: "Email and OTP are required." });

    const owner = await prisma.owner.findUnique({
      where: { email },
      select: { owner_id: true },
    });

    if (!owner) return res.status(401).json({ message: "Invalid OTP." });

    const record = await prisma.passwordResetOtp.findFirst({
      where: { owner_id: owner.owner_id },
      orderBy: { created_at: "desc" },
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
      return res
        .status(400)
        .json({ message: "OTP expired. Please request a new OTP." });
    }

    const isMatch = await compare(String(otp), record.otp_hash);

    if (!isMatch) {
      const newAttempts = record.wrong_attempts + 1;

      if (newAttempts >= 3) {
        const lockedUntil = new Date(Date.now() + 5 * 60 * 60 * 1000);

        await prisma.passwordResetOtp.update({
          where: { id: record.id },
          data: { wrong_attempts: newAttempts, locked_until: lockedUntil },
        });

        return res.status(423).json({
          message: "Too many wrong OTP attempts. Account locked for 5 hours.",
          locked_until: lockedUntil,
        });
      }

      await prisma.passwordResetOtp.update({
        where: { id: record.id },
        data: { wrong_attempts: newAttempts },
      });

      return res.status(401).json({
        message: "Invalid OTP.",
        remaining_attempts: 3 - newAttempts,
      });
    }

    await prisma.passwordResetOtp.update({
      where: { id: record.id },
      data: { verified_at: now },
    });

    const resetToken = sign(
      { owner_id: owner.owner_id, purpose: "reset_password" },
      process.env.JWT_SECRET,
      { expiresIn: "10m" }
    );

    return res
      .status(200)
      .json({ message: "OTP verified.", reset_token: resetToken });
  } catch (error) {
    console.error("forgotPasswordVerifyOtp error:", error);
    return res.status(500).json({ message: "Server error." });
  }
}

/* =========================
   FORGOT PASSWORD: RESET
========================= */
export async function forgotPasswordReset(req, res) {
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

    const decoded = verify(reset_token, process.env.JWT_SECRET);
    if (decoded.purpose !== "reset_password") {
      return res.status(401).json({ message: "Invalid reset token." });
    }

    const owner = await prisma.owner.findUnique({
      where: { owner_id: decoded.owner_id },
      select: { owner_id: true },
    });

    if (!owner) return res.status(404).json({ message: "Owner not found." });

    const hashed = await hash(new_password, 10);

    await prisma.owner.update({
      where: { owner_id: decoded.owner_id },
      data: { password: hashed },
    });

    return res
      .status(200)
      .json({ message: "Password reset successful. Please login." });
  } catch (error) {
    console.error("forgotPasswordReset error:", error);
    return res.status(500).json({ message: "Server error." });
  }
}

/* =========================
   SUPER ADMIN LOGIN
========================= */
const SUPER_ADMIN_EMAIL = "superadmin@smartinven.com";
const SUPER_ADMIN_PASSWORD = "Admin@1234";
const SUPER_ADMIN_ROLE = "superadmin";

export async function superAdminLogin(req, res) {
  try {
    let { email, password } = req.body;
    email = normalizeEmail(email);

    if (!email || !password) {
      return sendError(res, 400, "VALIDATION_REQUIRED_FIELDS", "Email and password are required.");
    }

    if (email !== SUPER_ADMIN_EMAIL || password !== SUPER_ADMIN_PASSWORD) {
      return sendError(res, 401, "INVALID_CREDENTIALS", "Invalid email or password.");
    }

    const token = sign(
      { role: SUPER_ADMIN_ROLE, email: SUPER_ADMIN_EMAIL },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
    );

    return sendSuccess(res, 200, {
      message: "Super admin login successful.",
      token,
      admin: { email: SUPER_ADMIN_EMAIL, role: SUPER_ADMIN_ROLE },
    });
  } catch (err) {
    console.error("Super admin login error:", err);
    return sendError(res, 500, "SERVER_ERROR", "Login failed.");
  }
}

/* =========================
   GET ALL OWNERS (Admin)
========================= */
export async function getAllOwners(req, res) {
  try {
    const owners = await prisma.owner.findMany({
      select: {
        owner_id: true,
        full_name: true,
        email: true,
        phone: true,
        status: true,
        created_at: true,
        package_id: true,
        package: {
          select: { package_key: true, package_name: true },
        },
      },
      orderBy: { created_at: "desc" },
    });

    return sendSuccess(res, 200, { owners });
  } catch (err) {
    console.error(err);
    return sendError(res, 500, "SERVER_ERROR", "Failed to fetch owners.", {
      detail: err?.message ?? "An unexpected error occurred.",
    });
  }
}

/* =========================
   REGISTRATION: SEND OTP
========================= */
export async function sendRegistrationOtp(req, res) {
  try {
    let { email } = req.body;
    email = normalizeEmail(email);

    if (!email) {
      return sendError(res, 400, "VALIDATION_REQUIRED_FIELDS", "Email is required.");
    }

    const emailError = validateEmail(email);
    if (emailError) {
      return sendError(res, 400, "VALIDATION_EMAIL_INVALID", emailError);
    }

    const existingOwner = await prisma.owner.findUnique({ where: { email } });
    if (existingOwner) {
      return sendError(res, 409, "EMAIL_ALREADY_EXISTS", "Email is already registered.");
    }

    const activeRecord = await prisma.registrationOtp.findFirst({
      where: { email },
      orderBy: { created_at: "desc" },
    });

    const now = new Date();

    if (activeRecord?.locked_until && activeRecord.locked_until > now) {
      return res.status(423).json({
        success: false,
        error_code: "ACCOUNT_LOCKED",
        message: "Too many wrong OTP attempts. Try later.",
        locked_until: activeRecord.locked_until,
      });
    }

    if (activeRecord?.last_sent_at) {
      const seconds = (now - new Date(activeRecord.last_sent_at)) / 1000;
      if (seconds < 30) {
        return res.status(429).json({
          success: false,
          error_code: "RATE_LIMIT",
          message: "Please wait before requesting another OTP.",
          retry_after: Math.ceil(30 - seconds),
        });
      }
    }

    const otp = generateOtp();
    const otpHash = await hash(otp, 10);
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    if (activeRecord) {
      // ✅ UPDATE existing record — preserves full_name, phone, password_hash, package_key
      await prisma.registrationOtp.update({
        where: { id: activeRecord.id },
        data: {
          otp_hash: otpHash,
          expires_at: expiresAt,
          wrong_attempts: 0,
          locked_until: null,
          last_sent_at: now,
          verified_at: null,
        },
      });
    } else {
      // ✅ CREATE new record (first-time, no prior record)
      await prisma.registrationOtp.create({
        data: {
          email,
          otp_hash: otpHash,
          expires_at: expiresAt,
          wrong_attempts: 0,
          locked_until: null,
          last_sent_at: now,
          verified_at: null,
        },
      });
    }

    await sendRegistrationOtpEmail({ to: email, otp });

    return sendSuccess(res, 200, {
      message: "OTP sent to email.",
      expires_in: 300,
    });
  } catch (error) {
    console.error("sendRegistrationOtp error:", error);
    return sendError(res, 500, "SERVER_ERROR", "Failed to send OTP.");
  }
}

/* =========================
   REGISTRATION: VERIFY OTP
========================= */
export async function verifyRegistrationOtp(req, res) {
  try {
    let { email, otp } = req.body;
    email = normalizeEmail(email);

    if (!email || !otp) {
      return sendError(res, 400, "VALIDATION_REQUIRED_FIELDS", "Email and OTP are required.");
    }

    const record = await prisma.registrationOtp.findFirst({
      where: { email },
      orderBy: { created_at: "desc" },
    });

    if (!record) {
      return sendError(res, 404, "OTP_NOT_FOUND", "No OTP found for this email.");
    }

    const now = new Date();

    // Check if locked
    if (record.locked_until && record.locked_until > now) {
      return res.status(423).json({
        success: false,
        error_code: "ACCOUNT_LOCKED",
        message: "Account is locked due to too many wrong attempts. Try later.",
        locked_until: record.locked_until,
      });
    }

    // Check if expired
    if (record.expires_at <= now) {
      return sendError(res, 400, "OTP_EXPIRED", "OTP has expired. Please request a new one.");
    }

    // Check if already verified
    if (record.verified_at) {
      return sendSuccess(res, 200, {
        message: "OTP already verified.",
        verified: true,
      });
    }

    // Verify OTP
    const isMatch = await compare(String(otp), record.otp_hash);

    if (!isMatch) {
      const newAttempts = record.wrong_attempts + 1;

      // Lock after 3 wrong attempts
      if (newAttempts >= 3) {
        const lockedUntil = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes

        await prisma.registrationOtp.update({
          where: { id: record.id },
          data: { wrong_attempts: newAttempts, locked_until: lockedUntil },
        });

        return res.status(423).json({
          success: false,
          error_code: "ACCOUNT_LOCKED",
          message: "Too many wrong OTP attempts. Account locked for 30 minutes.",
          locked_until: lockedUntil,
        });
      }

      await prisma.registrationOtp.update({
        where: { id: record.id },
        data: { wrong_attempts: newAttempts },
      });

      return sendError(res, 401, "INVALID_OTP", "Invalid OTP.", {
        remaining_attempts: 3 - newAttempts,
      });
    }

    // Mark as verified
    await prisma.registrationOtp.update({
      where: { id: record.id },
      data: { verified_at: now },
    });

    // ✅ CREATE OWNER ACCOUNT AFTER OTP VERIFICATION
    if (!record.full_name || !record.phone || !record.password_hash || !record.package_key) {
      return sendError(res, 400, "REGISTRATION_DATA_MISSING", "Registration data not found. Please register again.");
    }

    // Get or create package
    let pkg = await prisma.package.findUnique({ where: { package_key: record.package_key } });
    if (!pkg) {
      pkg = await prisma.package.create({
        data: {
          package_key: record.package_key,
          package_name: packageNameMap[record.package_key],
        },
      });
    }

    // Create owner account
    const owner = await prisma.owner.create({
      data: {
        full_name: record.full_name,
        phone: record.phone,
        email: record.email,
        password: record.password_hash,
        package_id: pkg.package_id,
        status: "trial", // default status
      },
      select: {
        owner_id: true,
        full_name: true,
        email: true,
        phone: true,
        package_id: true,
        status: true,
        package: { select: { package_key: true, package_name: true } },
      },
    });

    // ✅ Seed "general" category for Store package owners
    if (record.package_key === "store") {
      try {
        await prisma.storeCategory.create({
          data: {
            owner_id: owner.owner_id,
            category_name: "general",
          },
        });
      } catch (err) {
        console.error("Failed to create default store category:", err);
        // Don't fail registration if category creation fails
      }
    }

    // Generate token
    const token = generateToken({
      owner_id: owner.owner_id,
      email: owner.email,
      package_id: owner.package_id,
      package_key: owner.package.package_key,
    });

    return sendSuccess(res, 201, {
      message: "OTP verified and account created successfully.",
      verified: true,
      token,
      owner,
    });
  } catch (error) {
    console.error("verifyRegistrationOtp error:", error);
    return sendError(res, 500, "SERVER_ERROR", "Failed to verify OTP.");
  }
}
