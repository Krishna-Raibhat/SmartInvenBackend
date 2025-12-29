// const bcrypt = require("bcrypt");
// const jwt = require("jsonwebtoken");
// const prisma = require("../prisma/client");
// // adjust path if needed
// const { sendOtpEmail } = require("../utils/mailer");

// /* =========================
//    Helpers
// ========================= */
// const sendError = (res, status, error_code, message, extra = {}) => {
//   return res.status(status).json({
//     success: false,
//     error_code,
//     message,
//     ...extra,
//   });
// };

// const sendSuccess = (res, status, data) => {
//   return res.status(status).json({
//     success: true,
//     ...data,
//   });
// };

// const normalizeEmail = (email) =>
//   String(email || "")
//     .trim()
//     .toLowerCase();

// const generateToken = (owner) => {
//   if (!process.env.JWT_SECRET) throw new Error("JWT_SECRET_MISSING");

//   return jwt.sign(
//     {
//       owner_id: owner.owner_id,
//       email: owner.email,
//       package_id: owner.package_id,
//     },
//     process.env.JWT_SECRET,
//     { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
//   );
// };

// const generateOtp = () => String(Math.floor(100000 + Math.random() * 900000)); // 6 digits

// // ================= EMAIL VALIDATION =================
// const validateEmail = (email) => {
//   if (typeof email !== "string") return "Email must be a string.";

//   const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[A-Za-z]{2,}$/;

//   if (!emailRegex.test(email)) {
//     return "Invalid email address format.";
//   }

//   return null;
// };

// const validatePassword = (password) => {
//   const errors = [];
//   if (typeof password !== "string") return ["Password must be a string."];

//   if (password.length < 8)
//     errors.push("Password must be at least 8 characters.");
//   if (!/[A-Z]/.test(password))
//     errors.push("Password must contain at least 1 uppercase letter.");
//   if (!/[a-z]/.test(password))
//     errors.push("Password must contain at least 1 lowercase letter.");
//   if (!/[0-9]/.test(password))
//     errors.push("Password must contain at least 1 number.");
//   if (!/[^A-Za-z0-9]/.test(password))
//     errors.push("Password must contain at least 1 special character.");

//   return errors;
// };

// const validatePhone = (phone) => {
//   if (typeof phone !== "string") return "Phone must be a string.";
//   if (!/^\d{10}$/.test(phone)) return "Phone number must be exactly 10 digits.";
//   return null;
// };

// /* =========================
//    REGISTER
// ========================= */
// exports.register = async (req, res) => {
//   try {
//     let { full_name, phone, email, password, confirm_password } = req.body;

//     // normalize email
//     email = normalizeEmail(email);

//     // ================= REQUIRED FIELDS =================
//     if (!full_name || !phone || !email || !password || !confirm_password) {
//       return sendError(
//         res,
//         400,
//         "VALIDATION_REQUIRED_FIELDS",
//         "All fields are required."
//       );
//     }

//     // ================= EMAIL VALIDATION =================
//     const emailError = validateEmail(email);
//     if (emailError) {
//       return sendError(res, 400, "VALIDATION_EMAIL_INVALID", emailError);
//     }

//     // ================= PHONE VALIDATION =================
//     const phoneError = validatePhone(phone);
//     if (phoneError) {
//       return sendError(res, 400, "VALIDATION_PHONE_INVALID", phoneError);
//     }

//     // ================= PASSWORD MATCH =================
//     if (password !== confirm_password) {
//       return sendError(
//         res,
//         400,
//         "VALIDATION_PASSWORD_MISMATCH",
//         "Password and confirm password do not match."
//       );
//     }

//     // ================= PASSWORD STRENGTH =================
//     const passwordErrors = validatePassword(password);
//     if (passwordErrors.length) {
//       return sendError(
//         res,
//         400,
//         "VALIDATION_PASSWORD_WEAK",
//         "Password is not strong enough.",
//         { errors: passwordErrors }
//       );
//     }

//     // ================= UNIQUE CHECKS =================
//     const emailExists = await prisma.owner.findUnique({
//       where: { email },
//     });

//     if (emailExists) {
//       return sendError(
//         res,
//         409,
//         "EMAIL_ALREADY_EXISTS",
//         "Email is already registered."
//       );
//     }

//     const phoneExists = await prisma.owner.findUnique({
//       where: { phone },
//     });

//     if (phoneExists) {
//       return sendError(
//         res,
//         409,
//         "PHONE_ALREADY_EXISTS",
//         "Phone number is already registered."
//       );
//     }

//     // ================= HASH PASSWORD =================
//     const hashedPassword = await bcrypt.hash(password, 10);

//     // ================= ENSURE DEFAULT PACKAGE =================
//     let hardwarePkg = await prisma.package.findUnique({
//       where: { package_key: "hardware" },
//     });

//     if (!hardwarePkg) {
//       hardwarePkg = await prisma.package.create({
//         data: {
//           package_key: "hardware",
//           package_name: "Hardware Store",
//         },
//       });
//     }

//     // ================= CREATE OWNER =================
//     const owner = await prisma.owner.create({
//       data: {
//         full_name,
//         phone,
//         email,
//         password: hashedPassword,
//         package_id: hardwarePkg.package_id,
//       },
//       select: {
//         owner_id: true,
//         full_name: true,
//         email: true,
//         phone: true,
//         package_id: true,
//       },
//     });

//     // ================= TOKEN =================
//     const token = generateToken(owner);

//     return sendSuccess(res, 201, {
//       message: "Owner registered successfully.",
//       token,
//       owner,
//     });
//   } catch (err) {
//     console.error("Register error:", err);

//     // Prisma unique constraint fallback
//     if (err.code === "P2002") {
//       return sendError(
//         res,
//         409,
//         "DUPLICATE_VALUE",
//         "Email or phone already exists."
//       );
//     }

//     return sendError(res, 500, "SERVER_ERROR", "Registration failed.");
//   }
// };

// /* =========================
//    LOGIN
// ========================= */
// exports.login = async (req, res) => {
//   try {
//     let { email, password ,fcm_token} = req.body;
//     email = normalizeEmail(email);

//     if (!email || !password) {
//       return sendError(
//         res,
//         400,
//         "VALIDATION_REQUIRED_FIELDS",
//         "Email and password are required."
//       );
//     }

//     const owner = await prisma.owner.findUnique({
//       where: { email },
//       select: {
//         owner_id: true,
//         full_name: true,
//         email: true,
//         phone: true,
//         package_id: true,
//         password: true,
//       },
//     });

//     if (!owner) {
//       return sendError(
//         res,
//         401,
//         "INVALID_CREDENTIALS",
//         "Invalid email or password."
//       );
//     }

//     const isMatch = await bcrypt.compare(password, owner.password);
//     if (!isMatch) {
//       return sendError(
//         res,
//         401,
//         "INVALID_CREDENTIALS",
//         "Invalid email or password."
//       );
//     }
//     /* =========================
//       ✅ SAVE / UPDATE FCM TOKEN
//     ========================= */
//     if (fcm_token) {
//       await prisma.owner.update({
//         where: { owner_id: owner.owner_id },
//         data: { fcm_token },
//       });
//     }
//     const token = generateToken(owner);

//     return sendSuccess(res, 200, {
//       message: "Login successful.",
//       token,
//       owner: {
//         owner_id: owner.owner_id,
//         full_name: owner.full_name,
//         email: owner.email,
//         phone: owner.phone,
//       },
//     });
//   } catch (err) {
//     console.error(err);
//     return sendError(res, 500, "SERVER_ERROR", "Login failed.");
//   }
// };

// /* =========================
//    ME
// ========================= */
// exports.me = async (req, res) => {
//   try {
//     const ownerId = req.owner?.owner_id;
//     if (!ownerId)
//       return sendError(res, 401, "AUTH_UNAUTHORIZED", "Unauthorized.");

//     const owner = await prisma.owner.findUnique({
//       where: { owner_id: ownerId },
//       select: {
//         owner_id: true,
//         full_name: true,
//         email: true,
//         phone: true,
//         created_at: true,
//         package_id: true,
//       },
//     });

//     if (!owner)
//       return sendError(res, 404, "OWNER_NOT_FOUND", "Owner not found.");

//     return sendSuccess(res, 200, { owner });
//   } catch (err) {
//     console.error(err);
//     return sendError(res, 500, "SERVER_ERROR", "Failed to fetch profile.");
//   }
// };

// /* =========================
//    UPDATE PROFILE
// ========================= */
// exports.updateMe = async (req, res) => {
//   try {
//     const ownerId = req.owner?.owner_id;
//     if (!ownerId)
//       return sendError(res, 401, "AUTH_UNAUTHORIZED", "Unauthorized.");

//     const { full_name, phone, email } = req.body;
//     const normalizedEmail = email ? normalizeEmail(email) : null;

//     if (!full_name && !phone && !email) {
// exports.changePassword = async (req, res) => {
//   try {
//     const ownerId = req.owner?.owner_id;
//     if (!ownerId) return sendError(res, 401, "AUTH_UNAUTHORIZED", "Unauthorized.");

//     const { old_password, new_password, confirm_password } = req.body;

//     if (!old_password || !new_password || !confirm_password) {
//       return sendError(res, 400, "VALIDATION_REQUIRED_FIELDS", "All fields are required.");
//     }

//     if (new_password !== confirm_password) {
//       return sendError(res, 400, "VALIDATION_PASSWORD_MISMATCH", "Passwords do not match.");
//     }

//     const passwordErrors = validatePassword(new_password);
//     if (passwordErrors.length) {
//       return sendError(res, 400, "VALIDATION_PASSWORD_WEAK", "Password is not strong enough.", {
//         errors: passwordErrors,
//       });
//     }

//     const owner = await prisma.owner.findUnique({
//       where: { owner_id: ownerId },
//       select: { owner_id: true, password_hash: true },
//     });

//     if (!owner) return sendError(res, 404, "OWNER_NOT_FOUND", "Owner not found.");

//     const isOldMatch = await bcrypt.compare(old_password, owner.password);
//     if (!isOldMatch) {
//       return sendError(res, 401, "OLD_PASSWORD_INCORRECT", "Old password is incorrect.");
//     }

//     const sameAsOld = await bcrypt.compare(new_password, owner.password_hash);
//     if (sameAsOld) {
//       return sendError(res, 400, "PASSWORD_SAME_AS_OLD", "New password must be different.");
//       return sendError(
//         res,
//         400,
//         "VALIDATION_NO_FIELDS",
//         "At least one field is required."
//       );
//     }

//     const existingOwner = await prisma.owner.findUnique({
//       where: { owner_id: ownerId },
//       select: { owner_id: true, email: true, phone: true, package_id: true },
//     });

//     if (!existingOwner)
//       return sendError(res, 404, "OWNER_NOT_FOUND", "Owner not found.");

//     // email unique check (if changed)
//     if (normalizedEmail && normalizedEmail !== existingOwner.email) {
//       const emailExists = await prisma.owner.findFirst({
//         where: { email: normalizedEmail, NOT: { owner_id: ownerId } },
//         select: { owner_id: true },
//       });

//       if (emailExists) {
//         return sendError(
//           res,
//           409,
//           "EMAIL_ALREADY_IN_USE",
//           "Email already in use."
//         );
//       }
//     }

//     // phone validate + unique check (if changed)
//     if (phone && phone !== existingOwner.phone) {
//       const phoneError = validatePhone(phone);
//       if (phoneError)
//         return sendError(res, 400, "VALIDATION_PHONE_INVALID", phoneError);

//       const phoneExists = await prisma.owner.findFirst({
//         where: { phone, NOT: { owner_id: ownerId } },
//         select: { owner_id: true },
//       });

//       if (phoneExists) {
//         return sendError(
//           res,
//           409,
//           "PHONE_ALREADY_IN_USE",
//           "Phone already in use."
//         );
//       }
//     }

//     const updatedOwner = await prisma.owner.update({
//       where: { owner_id: ownerId },
//       data: {
//         ...(full_name ? { full_name } : {}),
//         ...(normalizedEmail ? { email: normalizedEmail } : {}),
//         ...(phone ? { phone } : {}),
//       },
//       select: {
//         owner_id: true,
//         full_name: true,
//         email: true,
//         phone: true,
//         package_id: true,
//       },
//     });

//     const token = generateToken(updatedOwner);

//     return sendSuccess(res, 200, {
//       message: "Profile updated.",
//       token,
//       owner: updatedOwner,
//     });
//   } catch (err) {
//     console.error(err);

//     if (err.code === "P2002") {
//       return sendError(
//         res,
//         409,
//         "DUPLICATE_VALUE",
//         "Email or phone already exists."
//       );
//     }

//     return sendError(res, 500, "SERVER_ERROR", "Profile update failed.");
//   }
// };


// /* =========================
//    FORGOT PASSWORD: SEND OTP
// ========================= */
// exports.forgotPasswordSendOtp = async (req, res) => {
//   try {
//     let { email } = req.body;
//     email = normalizeEmail(email);

//     if (!email)
//       return sendError(
//         res,
//         400,
//         "VALIDATION_REQUIRED_FIELDS",
//         "Email is required."
//       );

//     const owner = await prisma.owner.findUnique({
//       where: { email },
//       select: { owner_id: true, email: true },
//     });

//     // Security best practice: don't reveal whether email exists
//     if (!owner) {
// exports.forgotPasswordVerifyOtp = async (req, res) => {
//   try {
//     let { email, otp } = req.body;
//     email = normalizeEmail(email);

//     if (!email || !otp) return res.status(400).json({ message: "Email and OTP are required." });

//     const owner = await prisma.owner.findUnique({
//       where: { email },
//       select: { owner_id: true },
//     });

//     if (!owner) return res.status(401).json({ message: "Invalid OTP." });

//     const record = await prisma.passwordResetOtp.findFirst({
//       where: { owner_id: owner.owner_id },
//       orderBy: { created_at: "desc" },
//     });

//     if (!record) return res.status(401).json({ message: "Invalid OTP." });

//     const now = new Date();

//     if (record.locked_until && record.locked_until > now) {
//       return res.status(423).json({
//         message: "Account is locked. Try later.",
//         locked_until: record.locked_until,
//       });
//     }

//     if (record.expires_at <= now) {
//       return res.status(400).json({ message: "OTP expired. Please request a new OTP." });
//       return res
//         .status(200)
//         .json({ message: "If the email exists, an OTP has been sent." });
//     }

//     const activeRecord = await prisma.passwordResetOtp.findFirst({
//       where: { owner_id: owner.owner_id },
//       orderBy: { created_at: "desc" },
//     });

//     const now = new Date();

//     if (activeRecord?.locked_until && activeRecord.locked_until > now) {
//       return res.status(423).json({
//         message:
//           "Account is locked due to too many wrong OTP attempts. Try later.",
//         locked_until: activeRecord.locked_until,
//       });
//     }

//     if (activeRecord?.last_sent_at) {
//       const seconds = (now - new Date(activeRecord.last_sent_at)) / 1000;
//       if (seconds < 30) {
//         return res
//           .status(429)
//           .json({ message: "Please wait before requesting another OTP." });
//       }
//     }

//     const otp = generateOtp();
//     const otpHash = await bcrypt.hash(otp, 10);
//     const expiresAt = new Date(Date.now() + 2 * 60 * 1000); // 2 minutes

//     await prisma.passwordResetOtp.create({
//       data: {
//         owner_id: owner.owner_id,
//         email: owner.email,
//         otp_hash: otpHash,
//         expires_at: expiresAt,
//         wrong_attempts: 0,
//         locked_until: null,
//         last_sent_at: now,
//         verified_at: null,
//       },
//     });

//     await sendOtpEmail({ to: owner.email, otp });

//     return res.status(200).json({ message: "OTP sent to email." });
//   } catch (error) {
//     console.error("forgotPasswordSendOtp error:", error);
//     return sendError(res, 500, "SERVER_ERROR", "Server error.");
//   }
// };


// /* =========================
//    FORGOT PASSWORD: RESET
// ========================= */
// exports.forgotPasswordReset = async (req, res) => {
//   try {
//     const { reset_token, new_password, confirm_password } = req.body;

//     if (!reset_token || !new_password || !confirm_password) {
//       return res.status(400).json({
//         message: "reset_token, new_password and confirm_password are required.",
//       });
//     }

//     if (new_password !== confirm_password) {
//       return res.status(400).json({ message: "Passwords do not match." });
//     }

//     const passwordErrors = validatePassword(new_password);
//     if (passwordErrors.length) {
//       return res.status(400).json({
//         message: "New password is not strong enough.",
//         errors: passwordErrors,
//       });
//     }

//     const decoded = jwt.verify(reset_token, process.env.JWT_SECRET);
//     if (decoded.purpose !== "reset_password") {
//       return res.status(401).json({ message: "Invalid reset token." });
//     }

//     const owner = await prisma.owner.findUnique({
//       where: { owner_id: decoded.owner_id },
//       select: { owner_id: true },
//     });

//     if (!owner) return res.status(404).json({ message: "Owner not found." });

//     const hashed = await bcrypt.hash(new_password, 10);

//     await prisma.owner.update({
//       where: { owner_id: decoded.owner_id },
//       data: { password: hashed },
//     });

//     return res
//       .status(200)
//       .json({ message: "Password reset successful. Please login." });
//   } catch (error) {
//     console.error("forgotPasswordReset error:", error);
//     return res.status(500).json({ message: "Server error." });
//   }
// };

const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const prisma = require("../prisma/client");
// adjust path if needed
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
  String(email || "")
    .trim()
    .toLowerCase();

const generateToken = (owner) => {
  if (!process.env.JWT_SECRET) throw new Error("JWT_SECRET_MISSING");

  return jwt.sign(
    {
      owner_id: owner.owner_id,
      email: owner.email,
      package_id: owner.package_id,
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

/* =========================
   REGISTER
========================= */
exports.register = async (req, res) => {
  try {
    let { full_name, phone, email, password, confirm_password, package_key } = req.body;

    // normalize email
    email = normalizeEmail(email);
    package_key = String(package_key || "").trim().toLowerCase();
    // ================= REQUIRED FIELDS =================
    if (!full_name || !phone || !email || !password || !confirm_password || !package_key) {
      return sendError(
        res,
        400,
        "VALIDATION_REQUIRED_FIELDS",
        "All fields are required."
      );
    }

    // ================= EMAIL VALIDATION =================
    const emailError = validateEmail(email);
    if (emailError) {
      return sendError(res, 400, "VALIDATION_EMAIL_INVALID", emailError);
    }

    // ================= PHONE VALIDATION =================
    const phoneError = validatePhone(phone);
    if (phoneError) {
      return sendError(res, 400, "VALIDATION_PHONE_INVALID", phoneError);
    }

    // ================= PASSWORD MATCH =================
    if (password !== confirm_password) {
      return sendError(
        res,
        400,
        "VALIDATION_PASSWORD_MISMATCH",
        "Password and confirm password do not match."
      );
    }

    // ================= PASSWORD STRENGTH =================
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

    // ================= UNIQUE CHECKS =================
    const emailExists = await prisma.owner.findUnique({
      where: { email },
    });

    if (emailExists) {
      return sendError(
        res,
        409,
        "EMAIL_ALREADY_EXISTS",
        "Email is already registered."
      );
    }

    const phoneExists = await prisma.owner.findUnique({
      where: { phone },
    });

    if (phoneExists) {
      return sendError(
        res,
        409,
        "PHONE_ALREADY_EXISTS",
        "Phone number is already registered."
      );
    }

    // ================= HASH PASSWORD =================
    const hashedPassword = await bcrypt.hash(password, 10);

    // ================= ENSURE DEFAULT PACKAGE =================
    let hardwarePkg = await prisma.package.findUnique({
      where: { package_key: "hardware" },
    });

    if (!hardwarePkg) {
      hardwarePkg = await prisma.package.create({
        data: {
          package_key: "hardware",
          package_name: "Hardware Store",
        },
      });
    }

    // ================= CREATE OWNER =================
    const owner = await prisma.owner.create({
      data: {
        full_name,
        phone,
        email,
        password: hashedPassword,
        package_id: hardwarePkg.package_id,
      },
      select: {
        owner_id: true,
        full_name: true,
        email: true,
        phone: true,
        package_id: true,
      },
    });

    // ================= TOKEN =================
    const token = generateToken(owner);

    return sendSuccess(res, 201, {
      message: "Owner registered successfully.",
      token,
      owner,
    });
  } catch (err) {
    console.error("Register error:", err);

    // Prisma unique constraint fallback
    if (err.code === "P2002") {
      return sendError(
        res,
        409,
        "DUPLICATE_VALUE",
        "Email or phone already exists."
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
    let { email, password ,fcm_token} = req.body;
    email = normalizeEmail(email);

    if (!email || !password) {
      return sendError(
        res,
        400,
        "VALIDATION_REQUIRED_FIELDS",
        "Email and password are required."
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
      },
    });

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
    /* =========================
      ✅ SAVE / UPDATE FCM TOKEN
    ========================= */
    if (fcm_token) {
      await prisma.owner.update({
        where: { owner_id: owner.owner_id },
        data: { fcm_token },
      });
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
    if (!ownerId)
      return sendError(res, 401, "AUTH_UNAUTHORIZED", "Unauthorized.");

    const owner = await prisma.owner.findUnique({
      where: { owner_id: ownerId },
      select: {
        owner_id: true,
        full_name: true,
        email: true,
        phone: true,
        created_at: true,
        package_id: true,
      },
    });

    if (!owner)
      return sendError(res, 404, "OWNER_NOT_FOUND", "Owner not found.");

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
};

/* =========================
   CHANGE PASSWORD
========================= */
exports.changePassword = async (req, res) => {
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

    const hashed = await bcrypt.hash(new_password, 10);

    await prisma.owner.update({
      where: { owner_id: ownerId },
      data: { password: hashed },
    });

    return sendSuccess(res, 200, { message: "Password changed successfully." });
  } catch (err) {
    console.error(err);
    return sendError(res, 500, "SERVER_ERROR", "Password change failed.");
  }
};

/* =========================
   FORGOT PASSWORD: SEND OTP
========================= */
exports.forgotPasswordSendOtp = async (req, res) => {
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
    const otpHash = await bcrypt.hash(otp, 10);
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
};

/* =========================
   FORGOT PASSWORD: VERIFY OTP
========================= */
exports.forgotPasswordVerifyOtp = async (req, res) => {
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

    const isMatch = await bcrypt.compare(String(otp), record.otp_hash);

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

    const resetToken = jwt.sign(
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
};

/* =========================
   FORGOT PASSWORD: RESET
========================= */
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

    const decoded = jwt.verify(reset_token, process.env.JWT_SECRET);
    if (decoded.purpose !== "reset_password") {
      return res.status(401).json({ message: "Invalid reset token." });
    }

    const owner = await prisma.owner.findUnique({
      where: { owner_id: decoded.owner_id },
      select: { owner_id: true },
    });

    if (!owner) return res.status(404).json({ message: "Owner not found." });

    const hashed = await bcrypt.hash(new_password, 10);

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
};