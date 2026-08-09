import { hash, compare } from "bcrypt";
import jwt from "jsonwebtoken";
import { OAuth2Client } from "google-auth-library";
import { prisma } from "../prisma/client.js";
import {
  sendOtpEmail,
  sendRegistrationOtpEmail,
  sendNewDeviceOtpEmail,
  sendSuspiciousLoginEmail,
  sendDeviceVerificationLinksEmail,
  send2FaOtpEmail,
} from "../utils/mailer.js";
import { encryptSecret, decryptSecret } from "../utils/crypto.js";
import { generateSecret, verifySync, generateURI } from "otplib";
import crypto from "crypto";
import { hashOTP, verifyOTPHash } from "../utils/otp.js";
import { uploadToS3, getSignedUrl } from "../utils/s3.js";

const { sign, verify } = jwt;

const EXT_BY_MIME = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/svg+xml": "svg",
};

const extFromMimetype = (mimetype) => EXT_BY_MIME[mimetype] || "png";
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
    { expiresIn: process.env.JWT_EXPIRES_IN || "7d" },
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

const validatePan = (pan) => {
  if (typeof pan !== "string") return "PAN number must be a string.";
  if (!/^\d{9}$/.test(pan)) return "PAN number must be exactly 9 digits.";
  return null;
};

const packageNameMap = {
  hardware: "Hardware Store",
  clothing: "Clothing Store",
  grocery: "Grocery Store",
  store: "Store",
};

const APP_STORE_REVIEW_EMAIL = normalizeEmail(
  process.env.APP_STORE_REVIEW_EMAIL || "apple.review@elevatetech.com",
);

export async function register(req, res) {
  console.time("register:total");
  try {
    let {
      full_name,
      phone,
      email,
      password,
      confirm_password,
      package_key,
      status,
      business_category,
      business_name,
      pan_number,
    } = req.body;

    email = normalizeEmail(email);
    package_key = String(package_key || "")
      .trim()
      .toLowerCase();
    pan_number =
      pan_number !== undefined && pan_number !== null
        ? String(pan_number).trim()
        : "";

    if (
      !full_name ||
      !phone ||
      !email ||
      !password ||
      !confirm_password ||
      !package_key ||
      !business_name
    ) {
      return sendError(
        res,
        400,
        "VALIDATION_REQUIRED_FIELDS",
        "All fields are required.",
      );
    }
    business_name = String(business_name).trim();
    // ✅ allow only these packages
    const allowed = new Set(["hardware", "clothing", "grocery", "store"]);
    if (!allowed.has(package_key)) {
      return sendError(
        res,
        400,
        "VALIDATION_PACKAGE_INVALID",
        "Invalid package_key.",
      );
    }

    // ✅ validate status if provided
    const validStatuses = ["trial", "active", "inactive"];
    if (status && !validStatuses.includes(status)) {
      return sendError(
        res,
        400,
        "VALIDATION_STATUS_INVALID",
        "Invalid status. Must be one of: trial, active, inactive.",
      );
    }

    const emailError = validateEmail(email);
    if (emailError)
      return sendError(res, 400, "VALIDATION_EMAIL_INVALID", emailError);

    const phoneError = validatePhone(phone);
    if (phoneError)
      return sendError(res, 400, "VALIDATION_PHONE_INVALID", phoneError);

    const panError = pan_number ? validatePan(pan_number) : null;
    if (panError)
      return sendError(res, 400, "VALIDATION_PAN_INVALID", panError);

    if (password !== confirm_password) {
      return sendError(
        res,
        400,
        "VALIDATION_PASSWORD_MISMATCH",
        "Password and confirm password do not match.",
      );
    }

    const passwordErrors = validatePassword(password);
    if (passwordErrors.length) {
      return sendError(
        res,
        400,
        "VALIDATION_PASSWORD_WEAK",
        "Password is not strong enough.",
        { errors: passwordErrors },
      );
    }

    console.time("register:db-uniqueness-checks");
    const emailExists = await prisma.owner.findUnique({ where: { email } });
    if (emailExists)
      return sendError(
        res,
        409,
        "EMAIL_ALREADY_EXISTS",
        "Email is already registered.",
      );

    const phoneExists = await prisma.owner.findUnique({ where: { phone } });
    if (phoneExists)
      return sendError(
        res,
        409,
        "PHONE_ALREADY_EXISTS",
        "Phone number is already registered.",
      );
    const panExists = pan_number
      ? await prisma.owner.findUnique({ where: { pan_number } })
      : null;
    if (panExists)
      return sendError(
        res,
        409,
        "PAN_ALREADY_EXISTS",
        "PAN number is already registered.",
      );
    console.timeEnd("register:db-uniqueness-checks");

    console.time("register:bcrypt-password");
    const hashedPassword = await hash(password, 10);
    console.timeEnd("register:bcrypt-password");

    // ✅ Validation passed - Generate and send OTP
    const otp = generateOtp();
    console.time("register:bcrypt-otp");
    const otpHash = await hash(otp, 10);
    console.timeEnd("register:bcrypt-otp");
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    let finalBusinessCategory = business_category
      ? String(business_category).trim()
      : null;
    if (!finalBusinessCategory) {
      if (package_key === "grocery") finalBusinessCategory = "Grocery Store";
      else if (package_key === "clothing")
        finalBusinessCategory = "Clothing Store";
      else if (package_key === "hardware")
        finalBusinessCategory = "Hardware Store";
      else if (package_key === "store") finalBusinessCategory = "Store";
    }

    // If a business logo was uploaded, hold on to it (base64) until the
    // owner account (and its owner_id) actually exists after OTP verification.
    let businessLogoBase64 = null;
    let businessLogoMimetype = null;
    if (req.file) {
      if (!req.file.mimetype?.startsWith("image/")) {
        return sendError(
          res,
          400,
          "VALIDATION_LOGO_INVALID",
          "Business logo must be an image file.",
        );
      }
      businessLogoBase64 = req.file.buffer.toString("base64");
      businessLogoMimetype = req.file.mimetype;
    }

    // Store OTP with registration data
    console.time("register:db-create-otp-row");
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
        business_category: finalBusinessCategory,
        business_name,
        pan_number: pan_number || null,
        business_logo_base64: businessLogoBase64,
        business_logo_mimetype: businessLogoMimetype,
      },
    });
    console.timeEnd("register:db-create-otp-row");

    // Send OTP email
    sendRegistrationOtpEmail({ to: email, otp }).catch(err => console.error("Failed to send registration OTP email:", err));

    console.timeEnd("register:total");
    return sendSuccess(res, 200, {
      message: "Registration data validated. OTP sent to email.",
      requires_verification: true,
      expires_in: 300,
    });
  } catch (err) {
    console.error("Register error:", err);
    if (err.code === "P2002") {
      return sendError(
        res,
        409,
        "DUPLICATE_VALUE",
        "Email or phone already exists.",
      );
    }
    return sendError(res, 500, "SERVER_ERROR", "Registration failed.", {
      detail: err?.message ?? "An unexpected error occurred.",
    });
  }
}

export async function checkRegistrationAvailability(req, res) {
  try {
    let { email, phone, pan_number } = req.body;

    email = normalizeEmail(email);
    phone = String(phone ?? "").trim();
    pan_number = pan_number !== undefined ? String(pan_number).trim() : "";
    if (!email || !phone) {
      return sendError(
        res,
        400,
        "VALIDATION_REQUIRED_FIELDS",
        "Email and phone number are required.",
      );
    }

    const [existingEmail, existingPhone, existingPan] = await Promise.all([
      prisma.owner.findUnique({
        where: { email },
        select: { owner_id: true },
      }),

      prisma.owner.findUnique({
        where: { phone },
        select: { owner_id: true },
      }),
      pan_number
        ? prisma.owner.findUnique({
            where: { pan_number },
            select: { owner_id: true },
          })
        : Promise.resolve(null),
    ]);

    const emailExists = Boolean(existingEmail);
    const phoneExists = Boolean(existingPhone);
    const panExists = Boolean(existingPan);

    return sendSuccess(res, 200, {
      available: !emailExists && !phoneExists && !(pan_number && panExists),
      email_exists: emailExists,
      phone_exists: phoneExists,
      ...(pan_number ? { pan_exists: panExists } : {}),
    });
  } catch (err) {
    console.error("CHECK_REGISTRATION_AVAILABILITY_ERROR:", err);

    return sendError(
      res,
      500,
      "SERVER_ERROR",
      "Failed to verify registration details.",
    );
  }
}

/* =========================
   LOGIN
========================= */
// export async function login(req, res) {
//   try {
//     let {
//       email,
//       password,
//       fcm_token,
//       device_id,
//       device_name,
//       device_metadata,
//     } = req.body;
//     email = normalizeEmail(email);

//     if (!email || !password) {
//       return sendError(
//         res,
//         400,
//         "VALIDATION_REQUIRED_FIELDS",
//         "Email and password are required.",
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
//         status: true,
//         created_at: true,
//         subscription_expires_at: true,
//         trial_expires_at: true,
//         two_factor_enabled: true,
//         business_category: true,
//         business_name: true,
//         auth_provider: true,
//         failed_login_attempts: true,
//         login_locked_until: true,
//         package: { select: { package_key: true, package_name: true } },
//       },
//     });

//     if (!owner) {
//       return sendError(
//         res,
//         401,
//         "INVALID_CREDENTIALS",
//         "Invalid email or password.",
//       );
//     }

//     // Check if account is locked due to too many failed login attempts
//     if (
//       owner.login_locked_until &&
//       new Date() < new Date(owner.login_locked_until)
//     ) {
//       const remainingTime = Math.ceil(
//         (new Date(owner.login_locked_until).getTime() - Date.now()) / 60000,
//       );
//       return sendError(
//         res,
//         423,
//         "ACCOUNT_LOCKED",
//         `Too many failed login attempts. Account locked for ${remainingTime} more minute(s).`,
//         { locked_until: owner.login_locked_until },
//       );
//     }

//     // Check if account was created with Google or has no password
//     if (owner.auth_provider === "google" || !owner.password) {
//       return sendError(
//         res,
//         400,
//         "GOOGLE_ACCOUNT",
//         "This account was created with Google. Please sign in with Google instead.",
//       );
//     }

//     const isMatch = await compare(password, owner.password);
//     if (!isMatch) {
//       // Increment failed login attempts
//       const newAttempts = (owner.failed_login_attempts || 0) + 1;
//       const maxAttempts = 6;

//       if (newAttempts >= maxAttempts) {
//         // Lock account for 30 minutes
//         const lockUntil = new Date(Date.now() + 30 * 60 * 1000);
//         await prisma.owner.update({
//           where: { owner_id: owner.owner_id },
//           data: {
//             failed_login_attempts: newAttempts,
//             login_locked_until: lockUntil,
//             last_failed_login: new Date(),
//           },
//         });

//         return sendError(
//           res,
//           423,
//           "ACCOUNT_LOCKED",
//           "Too many failed login attempts. Account locked for 30 minutes.",
//           { locked_until: lockUntil },
//         );
//       }

//       // Update failed attempts
//       await prisma.owner.update({
//         where: { owner_id: owner.owner_id },
//         data: {
//           failed_login_attempts: newAttempts,
//           last_failed_login: new Date(),
//         },
//       });

//       const attemptsLeft = maxAttempts - newAttempts;
//       return sendError(
//         res,
//         401,
//         "INVALID_CREDENTIALS",
//         `Invalid email or password. ${attemptsLeft} attempt(s) remaining before account lock.`,
//       );
//     }

//     // Password correct - reset failed login attempts
//     if (owner.failed_login_attempts > 0 || owner.login_locked_until) {
//       await prisma.owner.update({
//         where: { owner_id: owner.owner_id },
//         data: {
//           failed_login_attempts: 0,
//           login_locked_until: null,
//           last_failed_login: null,
//         },
//       });
//     }

//     // Check account status
//     if (owner.status === "inactive") {
//       const pendingPayment = await prisma.paymentProof.findFirst({
//         where: {
//           owner_id: owner.owner_id,
//           status: "pending",
//         },
//       });

//       if (pendingPayment) {
//         return sendError(
//           res,
//           403,
//           "PAYMENT_PENDING",
//           "Your payment proof is under review. Please wait for approval.",
//           {
//             owner: {
//               owner_id: owner.owner_id,
//               full_name: owner.full_name,
//               email: owner.email,
//               phone: owner.phone,
//               package_id: owner.package_id,
//               status: owner.status,
//               package_key: owner.package?.package_key ?? null,
//               package_name: owner.package?.package_name ?? null,
//             },
//           },
//         );
//       }

//       if (
//         owner.subscription_expires_at &&
//         new Date(owner.subscription_expires_at) < new Date()
//       ) {
//         return sendError(
//           res,
//           403,
//           "SUBSCRIPTION_EXPIRED",
//           "Your subscription has expired. Please renew to continue.",
//           {
//             owner: {
//               owner_id: owner.owner_id,
//               full_name: owner.full_name,
//               email: owner.email,
//               phone: owner.phone,
//               package_id: owner.package_id,
//               status: owner.status,
//               package_key: owner.package?.package_key ?? null,
//               package_name: owner.package?.package_name ?? null,
//             },
//           },
//         );
//       }
//     }
//     if (owner.status === "trial") {
//       // First check if there's a pending payment (user chose yearly plan and uploaded payment)
//       const pendingPayment = await prisma.paymentProof.findFirst({
//         where: { owner_id: owner.owner_id, status: "pending" },
//         select: { id: true },
//       });

//       if (pendingPayment) {
//         return sendError(
//           res,
//           403,
//           "PAYMENT_PENDING",
//           "Your payment proof is under review. Please wait for approval.",
//           {
//             owner: {
//               owner_id: owner.owner_id,
//               full_name: owner.full_name,
//               email: owner.email,
//               phone: owner.phone,
//               package_id: owner.package_id,
//               status: owner.status,
//               package_key: owner.package?.package_key ?? null,
//               package_name: owner.package?.package_name ?? null,
//             },
//           },
//         );
//       }

//       // No pending payment - check if trial has expired (read directly from DB)
//       if (
//         owner.trial_expires_at &&
//         new Date() > new Date(owner.trial_expires_at)
//       ) {
//         return sendError(
//           res,
//           403,
//           "TRIAL_EXPIRED",
//           "Your 30-day trial has expired. Please subscribe to continue.",
//           {
//             owner: {
//               owner_id: owner.owner_id,
//               full_name: owner.full_name,
//               email: owner.email,
//               phone: owner.phone,
//               package_id: owner.package_id,
//               status: owner.status,
//               package_key: owner.package?.package_key ?? null,
//               package_name: owner.package?.package_name ?? null,
//             },
//           },
//         );
//       }
//     }

//     // Active subscription expiry check (was previously only checked under "inactive")
//     if (owner.status === "active") {
//       if (
//         owner.subscription_expires_at &&
//         new Date(owner.subscription_expires_at) < new Date()
//       ) {
//         return sendError(
//           res,
//           403,
//           "SUBSCRIPTION_EXPIRED",
//           "Your subscription has expired. Please renew to continue.",
//           {
//             owner: {
//               owner_id: owner.owner_id,
//               full_name: owner.full_name,
//               email: owner.email,
//               phone: owner.phone,
//               package_id: owner.package_id,
//               status: owner.status,
//               package_key: owner.package?.package_key ?? null,
//               package_name: owner.package?.package_name ?? null,
//             },
//           },
//         );
//       }
//     }

//     if (fcm_token) {
//       await prisma.owner.update({
//         where: { owner_id: owner.owner_id },
//         data: { fcm_token },
//       });
//     }

//     // Check Device ID Verification
//     let isDeviceTrusted = false;
//     let metadataMismatchDetected = false;

//     if (device_id) {
//       const dbDevice = await prisma.userDevice.findUnique({
//         where: { owner_id_device_id: { owner_id: owner.owner_id, device_id } },
//       });
//       if (dbDevice && dbDevice.is_trusted) {
//         // Retrieve stored metadata (Prisma returns it as object natively)
//         const stored = dbDevice.device_metadata || {};
//         const current = device_metadata || {};

//         // Check for mismatch (compare model and brand)
//         if (stored.model !== current.model || stored.brand !== current.brand) {
//           metadataMismatchDetected = true;
//           // Revoke trust
//           await prisma.userDevice.update({
//             where: {
//               owner_id_device_id: { owner_id: owner.owner_id, device_id },
//             },
//             data: { is_trusted: false },
//           });
//           // Send warning email alert
//           const deviceLabel =
//             current.model || current.brand || "Unknown Device";
//           const currentIp =
//             req.ip ||
//             req.headers["x-forwarded-for"] ||
//             req.socket.remoteAddress;
//           sendSuspiciousLoginEmail({
//             to: owner.email,
//             device_name: deviceLabel,
//             ip_address: currentIp,
//           }).catch(err => console.error("Failed to send suspicious login email:", err));
//           console.warn(
//             `[SECURITY] Metadata anomaly mismatch detected for device_id: ${device_id}. Trust revoked.`,
//           );
//         } else {
//           isDeviceTrusted = true;
//           // Update device details
//           await prisma.userDevice.update({
//             where: {
//               owner_id_device_id: { owner_id: owner.owner_id, device_id },
//             },
//             data: {
//               ip_address:
//                 req.ip ||
//                 req.headers["x-forwarded-for"] ||
//                 req.socket.remoteAddress,
//               user_agent: req.headers["user-agent"] || null,
//               last_used_at: new Date(),
//             },
//           });
//         }
//       }
//     }

//     if (!isDeviceTrusted) {
//       // Check if it's the first device after registration
//       const trustedDeviceCount = await prisma.userDevice.count({
//         where: { owner_id: owner.owner_id, is_trusted: true },
//       });

//       if (trustedDeviceCount === 0) {
//         const newDeviceId = device_id || crypto.randomUUID();
//         const finalDeviceName =
//           device_name ||
//           device_metadata?.model ||
//           device_metadata?.brand ||
//           "Unknown Device";
//         await prisma.userDevice.create({
//           data: {
//             device_id: newDeviceId,
//             owner_id: owner.owner_id,
//             device_name: finalDeviceName,
//             device_metadata: device_metadata || {},
//             ip_address:
//               req.ip ||
//               req.headers["x-forwarded-for"] ||
//               req.socket.remoteAddress,
//             user_agent: req.headers["user-agent"] || null,
//             is_trusted: true,
//           },
//         });
//         isDeviceTrusted = true;
//         device_id = newDeviceId;
//       }
//     }

//     if (!isDeviceTrusted) {
//       // Generate Device verification session and a reserved device ID
//       const reservedDeviceId = device_id || crypto.randomUUID();
//       const verificationToken = crypto.randomBytes(32).toString("hex");

//       await prisma.deviceVerification.create({
//         data: {
//           verification_token: verificationToken,
//           owner_id: owner.owner_id,
//           device_id: reservedDeviceId,
//           status: "pending",
//           device_metadata: device_metadata || {},
//           expires_at: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
//         },
//       });

//       const finalDeviceName =
//         device_name ||
//         device_metadata?.model ||
//         device_metadata?.brand ||
//         "Unknown Device";

//       // Email links
//       const baseUrl =
//         process.env.BACKEND_URL || `${req.protocol}://${req.get("host")}`;
//       const approveLink = `${baseUrl}/api/auth/device-verification/approve?token=${verificationToken}`;
//       const denyLink = `${baseUrl}/api/auth/device-verification/deny?token=${verificationToken}`;

//       sendDeviceVerificationLinksEmail({
//         to: owner.email,
//         device_name: finalDeviceName,
//         ip_address: req.ip,
//         approve_link: approveLink,
//         deny_link: denyLink,
//       }).catch(err => console.error("Failed to send device verification email:", err));

//       const reasonMessage = metadataMismatchDetected
//         ? "Suspicious device activity. Trust has been revoked. Verification link sent to email."
//         : "New device detected. Verification link sent to email.";

//       return res.status(200).json({
//         success: false,
//         requires_device_verification: true,
//         device_verification_required: true,
//         verification_token: verificationToken,
//         device_session_token: verificationToken,
//         message: reasonMessage,
//       });
//     }

//     // Check 2FA Verification
//     if (owner.two_factor_enabled) {
//       const otp = generateOtp();
//       const otpHash = await hash(otp, 10);
//       const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

//       await prisma.twoFactorOtp.upsert({
//         where: { owner_id: owner.owner_id },
//         update: {
//           otp_hash: otpHash,
//           expires_at: expiresAt,
//         },
//         create: {
//           owner_id: owner.owner_id,
//           otp_hash: otpHash,
//           expires_at: expiresAt,
//         },
//       });

//       send2FaOtpEmail({
//         to: owner.email,
//         otp,
//       }).catch(err => console.error("Failed to send 2FA OTP email:", err));

//       const preAuthToken = sign(
//         {
//           owner_id: owner.owner_id,
//           purpose: "2fa_verification",
//         },
//         process.env.JWT_SECRET,
//         { expiresIn: "5m" }, // 5 minutes matching OTP
//       );

//       return sendSuccess(res, 200, {
//         require_2fa: true,
//         pre_auth_token: preAuthToken,
//         message: "2FA verification code sent to your email.",
//       });
//     }

//     const token = generateToken({
//       owner_id: owner.owner_id,
//       email: owner.email,
//       package_id: owner.package_id,
//       package_key: owner.package?.package_key ?? null,
//     });

//     return sendSuccess(res, 200, {
//       message: "Login successful.",
//       token,
//       device_id,
//       owner: {
//         owner_id: owner.owner_id,
//         full_name: owner.full_name,
//         email: owner.email,
//         phone: owner.phone,
//         package_id: owner.package_id,
//         business_category: owner.business_category,
//         business_name: owner.business_name,
//         status: owner.status,
//         package_key: owner.package?.package_key ?? null,
//         package_name: owner.package?.package_name ?? null,
//         two_factor_enabled: owner.two_factor_enabled,
//       },
//     });
//   } catch (err) {
//     console.error(err);
//     return sendError(res, 500, "SERVER_ERROR", "Login failed.", {
//       detail: err?.message ?? "An unexpected error occurred.",
//     });
//   }
// }
export async function login(req, res) {
  try {
    let {
      email,
      password,
      fcm_token,
      device_id,
      device_name,
      device_metadata,
    } = req.body;
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
        trial_expires_at: true,
        two_factor_enabled: true,
        business_category: true,
        business_name: true,
        auth_provider: true,
        failed_login_attempts: true,
        login_locked_until: true,
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

    // Check if account is locked due to too many failed login attempts
    if (
      owner.login_locked_until &&
      new Date() < new Date(owner.login_locked_until)
    ) {
      const remainingTime = Math.ceil(
        (new Date(owner.login_locked_until).getTime() - Date.now()) / 60000,
      );
      return sendError(
        res,
        423,
        "ACCOUNT_LOCKED",
        `Too many failed login attempts. Account locked for ${remainingTime} more minute(s).`,
        { locked_until: owner.login_locked_until },
      );
    }

    // Check if account was created with Google or has no password
    if (owner.auth_provider === "google" || !owner.password) {
      return sendError(
        res,
        400,
        "GOOGLE_ACCOUNT",
        "This account was created with Google. Please sign in with Google instead.",
      );
    }

    const isMatch = await compare(password, owner.password);
    if (!isMatch) {
      // Increment failed login attempts
      const newAttempts = (owner.failed_login_attempts || 0) + 1;
      const maxAttempts = 10;

      if (newAttempts >= maxAttempts) {
        // Lock account for 30 minutes
        const lockUntil = new Date(Date.now() + 30 * 60 * 1000);
        await prisma.owner.update({
          where: { owner_id: owner.owner_id },
          data: {
            failed_login_attempts: newAttempts,
            login_locked_until: lockUntil,
            last_failed_login: new Date(),
          },
        });

        return sendError(
          res,
          423,
          "ACCOUNT_LOCKED",
          "Too many failed login attempts. Account locked for 30 minutes.",
          { locked_until: lockUntil },
        );
      }

      // Update failed attempts
      await prisma.owner.update({
        where: { owner_id: owner.owner_id },
        data: {
          failed_login_attempts: newAttempts,
          last_failed_login: new Date(),
        },
      });

      const attemptsLeft = maxAttempts - newAttempts;
      return sendError(
        res,
        401,
        "INVALID_CREDENTIALS",
        `Invalid email or password. ${attemptsLeft} attempt(s) remaining before account lock.`,
      );
    }

    // Password correct - reset failed login attempts
    if (owner.failed_login_attempts > 0 || owner.login_locked_until) {
      await prisma.owner.update({
        where: { owner_id: owner.owner_id },
        data: {
          failed_login_attempts: 0,
          login_locked_until: null,
          last_failed_login: null,
        },
      });
    }

    // Check account status
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
      // Check if trial has expired (read directly from DB)
      if (
        owner.trial_expires_at &&
        new Date() > new Date(owner.trial_expires_at)
      ) {
        return sendError(
          res,
          403,
          "TRIAL_EXPIRED",
          "Your 30-day trial has expired. Please subscribe to continue.",
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

    // Active subscription expiry check (was previously only checked under "inactive")
    if (owner.status === "active") {
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

    if (fcm_token) {
      await prisma.owner.update({
        where: { owner_id: owner.owner_id },
        data: { fcm_token },
      });
    }

    // Check Device ID Verification
    let isDeviceTrusted = false;
    let metadataMismatchDetected = false;
    const isAppStoreReviewAccount = owner.email === APP_STORE_REVIEW_EMAIL;

    if (isAppStoreReviewAccount) {
      // App Store reviewers use an unfamiliar device with no way to approve
      // it via email — treat this one account as always trusted.
      isDeviceTrusted = true;
    } else if (device_id) {
      const dbDevice = await prisma.userDevice.findUnique({
        where: { owner_id_device_id: { owner_id: owner.owner_id, device_id } },
      });
      if (dbDevice && dbDevice.is_trusted) {
        // Retrieve stored metadata (Prisma returns it as object natively)
        const stored = dbDevice.device_metadata || {};
        const current = device_metadata || {};

        // Check for mismatch (compare model and brand)
        if (stored.model !== current.model || stored.brand !== current.brand) {
          metadataMismatchDetected = true;
          // Revoke trust
          await prisma.userDevice.update({
            where: {
              owner_id_device_id: { owner_id: owner.owner_id, device_id },
            },
            data: { is_trusted: false },
          });
          // Send warning email alert
          const deviceLabel =
            current.model || current.brand || "Unknown Device";
          const currentIp =
            req.ip ||
            req.headers["x-forwarded-for"] ||
            req.socket.remoteAddress;
          sendSuspiciousLoginEmail({
            to: owner.email,
            device_name: deviceLabel,
            ip_address: currentIp,
          }).catch(err => console.error("Failed to send suspicious login email:", err));
          console.warn(
            `[SECURITY] Metadata anomaly mismatch detected for device_id: ${device_id}. Trust revoked.`,
          );
        } else {
          isDeviceTrusted = true;
          // Update device details
          await prisma.userDevice.update({
            where: {
              owner_id_device_id: { owner_id: owner.owner_id, device_id },
            },
            data: {
              ip_address:
                req.ip ||
                req.headers["x-forwarded-for"] ||
                req.socket.remoteAddress,
              user_agent: req.headers["user-agent"] || null,
              last_used_at: new Date(),
            },
          });
        }
      }
    }

    if (!isDeviceTrusted) {
      // Check if it's the first device after registration
      const trustedDeviceCount = await prisma.userDevice.count({
        where: { owner_id: owner.owner_id, is_trusted: true },
      });

      if (trustedDeviceCount === 0) {
        const newDeviceId = device_id || crypto.randomUUID();
        const finalDeviceName =
          device_name ||
          device_metadata?.model ||
          device_metadata?.brand ||
          "Unknown Device";
        await prisma.userDevice.create({
          data: {
            device_id: newDeviceId,
            owner_id: owner.owner_id,
            device_name: finalDeviceName,
            device_metadata: device_metadata || {},
            ip_address:
              req.ip ||
              req.headers["x-forwarded-for"] ||
              req.socket.remoteAddress,
            user_agent: req.headers["user-agent"] || null,
            is_trusted: true,
          },
        });
        isDeviceTrusted = true;
        device_id = newDeviceId;
      }
    }

    if (!isDeviceTrusted) {
      // Generate Device verification session and a reserved device ID
      const reservedDeviceId = device_id || crypto.randomUUID();
      const verificationToken = crypto.randomBytes(32).toString("hex");

      await prisma.deviceVerification.create({
        data: {
          verification_token: verificationToken,
          owner_id: owner.owner_id,
          device_id: reservedDeviceId,
          status: "pending",
          device_metadata: device_metadata || {},
          expires_at: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
        },
      });

      const finalDeviceName =
        device_name ||
        device_metadata?.model ||
        device_metadata?.brand ||
        "Unknown Device";

      // Email links
      const baseUrl =
        process.env.BACKEND_URL || `${req.protocol}://${req.get("host")}`;
      const approveLink = `${baseUrl}/api/auth/device-verification/approve?token=${verificationToken}`;
      const denyLink = `${baseUrl}/api/auth/device-verification/deny?token=${verificationToken}`;

      sendDeviceVerificationLinksEmail({
        to: owner.email,
        device_name: finalDeviceName,
        ip_address: req.ip,
        approve_link: approveLink,
        deny_link: denyLink,
      }).catch(err => console.error("Failed to send device verification email:", err));

      const reasonMessage = metadataMismatchDetected
        ? "Suspicious device activity. Trust has been revoked. Verification link sent to email."
        : "New device detected. Verification link sent to email.";

      return res.status(200).json({
        success: false,
        requires_device_verification: true,
        device_verification_required: true,
        verification_token: verificationToken,
        device_session_token: verificationToken,
        message: reasonMessage,
      });
    }

    // Check 2FA Verification
    // if (owner.two_factor_enabled) {
    //   const otp = generateOtp();
    //   const otpHash = await hash(otp, 10);
    //   const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    //   await prisma.twoFactorOtp.upsert({
    // Check 2FA Verification
    if (owner.two_factor_enabled && !isAppStoreReviewAccount) {
      const otp = generateOtp();
      const otpHash = await hash(otp, 10);
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

      await prisma.twoFactorOtp.upsert({
        where: { owner_id: owner.owner_id },
        update: {
          otp_hash: otpHash,
          expires_at: expiresAt,
        },
        create: {
          owner_id: owner.owner_id,
          otp_hash: otpHash,
          expires_at: expiresAt,
        },
      });

      send2FaOtpEmail({
        to: owner.email,
        otp,
      }).catch(err => console.error("Failed to send 2FA OTP email:", err));

      const preAuthToken = sign(
        {
          owner_id: owner.owner_id,
          purpose: "2fa_verification",
        },
        process.env.JWT_SECRET,
        { expiresIn: "5m" }, // 5 minutes matching OTP
      );

      return sendSuccess(res, 200, {
        require_2fa: true,
        pre_auth_token: preAuthToken,
        message: "2FA verification code sent to your email.",
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
      device_id,
      owner: {
        owner_id: owner.owner_id,
        full_name: owner.full_name,
        email: owner.email,
        phone: owner.phone,
        package_id: owner.package_id,
        business_category: owner.business_category,
        business_name: owner.business_name,
        status: owner.status,
        package_key: owner.package?.package_key ?? null,
        package_name: owner.package?.package_name ?? null,
        two_factor_enabled: owner.two_factor_enabled,
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
// export async function me(req, res) {
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
//         status: true,
//         created_at: true,
//         package_id: true,
//         business_category: true,
//         subscription_expires_at:true,
//         two_factor_enabled: true,
//       },
//     });

//     if (!owner)
//       return sendError(res, 404, "OWNER_NOT_FOUND", "Owner not found.");

//     return sendSuccess(res, 200, { owner });
//   } catch (err) {
//     console.error(err);
//     return sendError(res, 500, "SERVER_ERROR", "Failed to fetch profile.");
//   }
// }
export async function me(req, res) {
  try {
    const ownerId = req.owner?.owner_id;

    if (!ownerId) {
      return sendError(res, 401, "AUTH_UNAUTHORIZED", "Unauthorized.");
    }

    const owner = await prisma.owner.findUnique({
      where: {
        owner_id: ownerId,
      },
      select: {
        owner_id: true,
        full_name: true,
        email: true,
        phone: true,
        status: true,
        created_at: true,
        package_id: true,
        business_category: true,
        business_name: true,
        business_logo: true,
        pan_number: true,
        subscription_expires_at: true,
        two_factor_enabled: true,

        package: {
          select: {
            package_key: true,
            package_name: true,
          },
        },

        paymentProofs: {
          where: {
            status: "pending",
          },
          orderBy: {
            created_at: "desc",
          },
          take: 1,
          select: {
            id: true,
            status: true,
            created_at: true,
          },
        },
      },
    });

    if (!owner) {
      return sendError(res, 404, "OWNER_NOT_FOUND", "Owner not found.");
    }

    const pendingPayment = owner.paymentProofs[0] ?? null;
    const businessLogoUrl = owner.business_logo
      ? await getSignedUrl(owner.business_logo, 24 * 60 * 60)
      : null;

    return sendSuccess(res, 200, {
      owner: {
        owner_id: owner.owner_id,
        full_name: owner.full_name,
        email: owner.email,
        phone: owner.phone,
        status: owner.status,
        created_at: owner.created_at,
        package_id: owner.package_id,
        package_key: owner.package?.package_key ?? null,
        package_name: owner.package?.package_name ?? null,
        business_category: owner.business_category,
        business_name: owner.business_name,
        business_logo: owner.business_logo,
        business_logo_url: businessLogoUrl,
        pan_number: owner.pan_number,
        subscription_expires_at: owner.subscription_expires_at,
        two_factor_enabled: owner.two_factor_enabled,

        has_pending_payment: pendingPayment != null,
        payment_status: pendingPayment?.status ?? null,
        payment_submitted_at: pendingPayment?.created_at ?? null,
      },
    });
  } catch (err) {
    console.error("ME_PROFILE_ERROR:", err);

    return sendError(res, 500, "SERVER_ERROR", "Failed to fetch profile.", {
      detail: err?.message ?? "Unexpected error.",
    });
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

    const { full_name, phone, email, business_name, pan_number } = req.body;
    const normalizedEmail = email ? normalizeEmail(email) : null;
    const trimmedBusinessName =
      business_name !== undefined ? String(business_name).trim() : undefined;
    const trimmedPanNumber =
      pan_number !== undefined ? String(pan_number).trim() : undefined;

    if (
      !full_name &&
      !phone &&
      !email &&
      !trimmedBusinessName &&
      !trimmedPanNumber &&
      !req.file
    ) {
      return sendError(
        res,
        400,
        "VALIDATION_NO_FIELDS",
        "At least one field is required.",
      );
    }

    if (req.file && !req.file.mimetype?.startsWith("image/")) {
      return sendError(
        res,
        400,
        "VALIDATION_LOGO_INVALID",
        "Business logo must be an image file.",
      );
    }
    if (trimmedBusinessName === "") {
      return sendError(
        res,
        400,
        "VALIDATION_BUSINESS_NAME_EMPTY",
        "Business name cannot be empty.",
      );
    }
    if (trimmedPanNumber === "") {
      return sendError(
        res,
        400,
        "VALIDATION_PAN_EMPTY",
        "PAN number cannot be empty.",
      );
    }
    // Validate email format if provided
    if (normalizedEmail) {
      const emailError = validateEmail(normalizedEmail);
      if (emailError) {
        return sendError(res, 400, "VALIDATION_EMAIL_INVALID", emailError);
      }
    }
    // Validate PAN format if provided
    if (trimmedPanNumber) {
      const panError = validatePan(trimmedPanNumber);
      if (panError) {
        return sendError(res, 400, "VALIDATION_PAN_INVALID", panError);
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
          "Email already in use.",
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
          "Phone already in use.",
        );
      }
    }
    // PAN unique check (if changed)
    if (trimmedPanNumber && trimmedPanNumber !== existingOwner.pan_number) {
      const panExists = await prisma.owner.findFirst({
        where: { pan_number: trimmedPanNumber, NOT: { owner_id: ownerId } },
        select: { owner_id: true },
      });

      if (panExists) {
        return sendError(
          res,
          409,
          "PAN_ALREADY_IN_USE",
          "PAN number already in use.",
        );
      }
    }

    let businessLogoKey;
    if (req.file) {
      const ext = extFromMimetype(req.file.mimetype);
      // Same key every time -> re-uploading simply overwrites the old logo.
      businessLogoKey = `businesslogo/${ownerId}/logo.${ext}`;
      await uploadToS3(req.file.buffer, businessLogoKey, req.file.mimetype);
    }

    const updatedOwner = await prisma.owner.update({
      where: { owner_id: ownerId },
      data: {
        ...(full_name ? { full_name } : {}),
        ...(normalizedEmail ? { email: normalizedEmail } : {}),
        ...(phone ? { phone } : {}),
        ...(trimmedBusinessName ? { business_name: trimmedBusinessName } : {}),
        ...(trimmedPanNumber ? { pan_number: trimmedPanNumber } : {}),
        ...(businessLogoKey ? { business_logo: businessLogoKey } : {}),
      },
      select: {
        owner_id: true,
        full_name: true,
        email: true,
        phone: true,
        package_id: true,
        business_name: true,
        business_logo: true,
        pan_number: true,
        two_factor_enabled: true,
      },
    });

    const businessLogoUrl = updatedOwner.business_logo
      ? await getSignedUrl(updatedOwner.business_logo, 24 * 60 * 60)
      : null;

    const token = generateToken(updatedOwner);

    return sendSuccess(res, 200, {
      message: "Profile updated.",
      token,
      owner: {
        ...updatedOwner,
        business_logo_url: businessLogoUrl,
      },
    });
  } catch (err) {
    console.error(err);

    if (err.code === "P2002") {
      return sendError(
        res,
        409,
        "DUPLICATE_VALUE",
        "Email,Phone or PAN number already exists.",
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
        "All fields are required.",
      );
    }

    if (new_password !== confirm_password) {
      return sendError(
        res,
        400,
        "VALIDATION_PASSWORD_MISMATCH",
        "Passwords do not match.",
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
        },
      );
    }

    const owner = await prisma.owner.findUnique({
      where: { owner_id: ownerId },
      select: { owner_id: true, password: true, auth_provider: true },
    });

    if (!owner)
      return sendError(res, 404, "OWNER_NOT_FOUND", "Owner not found.");

    // Check if this is a Google account without a password
    if (!owner.password || owner.auth_provider === "google") {
      return sendError(
        res,
        400,
        "GOOGLE_ACCOUNT",
        "This account uses Google Sign-In. Password changes are not applicable.",
      );
    }

    const isOldMatch = await compare(old_password, owner.password);
    if (!isOldMatch) {
      return sendError(
        res,
        401,
        "OLD_PASSWORD_INCORRECT",
        "Old password is incorrect.",
      );
    }

    const sameAsOld = await compare(new_password, owner.password);
    if (sameAsOld) {
      return sendError(
        res,
        400,
        "PASSWORD_SAME_AS_OLD",
        "New password must be different.",
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
        "Email is required.",
      );

    const owner = await prisma.owner.findUnique({
      where: { email },
      select: { owner_id: true, email: true, auth_provider: true },
    });

    // Security best practice: don't reveal whether email exists
    if (!owner) {
      return res
        .status(200)
        .json({ message: "If the email exists, an OTP has been sent." });
    }

    // Check if this is a Google account
    if (owner.auth_provider === "google") {
      return sendError(
        res,
        400,
        "GOOGLE_ACCOUNT",
        "This account uses Google Sign-In. Password reset is not applicable.",
      );
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

    sendOtpEmail({ to: owner.email, otp }).catch(err => console.error("Failed to send password reset OTP email:", err));

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
      { expiresIn: "10m" },
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
      return sendError(
        res,
        400,
        "VALIDATION_REQUIRED_FIELDS",
        "Email and password are required.",
      );
    }

    if (email !== SUPER_ADMIN_EMAIL || password !== SUPER_ADMIN_PASSWORD) {
      return sendError(
        res,
        401,
        "INVALID_CREDENTIALS",
        "Invalid email or password.",
      );
    }

    const token = sign(
      { role: SUPER_ADMIN_ROLE, email: SUPER_ADMIN_EMAIL },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || "7d" },
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
      return sendError(
        res,
        400,
        "VALIDATION_REQUIRED_FIELDS",
        "Email is required.",
      );
    }

    const emailError = validateEmail(email);
    if (emailError) {
      return sendError(res, 400, "VALIDATION_EMAIL_INVALID", emailError);
    }

    const existingOwner = await prisma.owner.findUnique({ where: { email } });
    if (existingOwner) {
      return sendError(
        res,
        409,
        "EMAIL_ALREADY_EXISTS",
        "Email is already registered.",
      );
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

    sendRegistrationOtpEmail({ to: email, otp }).catch(err => console.error("Failed to send registration OTP email:", err));

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
      return sendError(
        res,
        400,
        "VALIDATION_REQUIRED_FIELDS",
        "Email and OTP are required.",
      );
    }

    const record = await prisma.registrationOtp.findFirst({
      where: { email },
      orderBy: { created_at: "desc" },
    });

    if (!record) {
      return sendError(
        res,
        404,
        "OTP_NOT_FOUND",
        "No OTP found for this email.",
      );
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
      return sendError(
        res,
        400,
        "OTP_EXPIRED",
        "OTP has expired. Please request a new one.",
      );
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
          message:
            "Too many wrong OTP attempts. Account locked for 30 minutes.",
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
    if (
      !record.full_name ||
      !record.phone ||
      !record.password_hash ||
      !record.package_key ||
      !record.business_name
    ) {
      return sendError(
        res,
        400,
        "REGISTRATION_DATA_MISSING",
        "Registration data not found. Please register again.",
      );
    }

    // Get or create package
    let pkg = await prisma.package.findUnique({
      where: { package_key: record.package_key },
    });
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
        business_category: record.business_category,
        business_name: record.business_name,
        pan_number: record.pan_number,
        status: "trial", // default status
        trial_expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30-day trial
      },
      select: {
        owner_id: true,
        full_name: true,
        email: true,
        phone: true,
        package_id: true,
        business_category: true,
        business_name: true,
        pan_number: true,
        status: true,
        trial_expires_at: true,
        package: { select: { package_key: true, package_name: true } },
      },
    });

    // ✅ Upload the business logo (if one was provided during registration)
    // now that we have a real owner_id to namespace it under.
    let businessLogoKey = null;
    if (record.business_logo_base64) {
      try {
        const buffer = Buffer.from(record.business_logo_base64, "base64");
        const ext = extFromMimetype(record.business_logo_mimetype);
        const key = `businesslogo/${owner.owner_id}/logo.${ext}`;
        await uploadToS3(
          buffer,
          key,
          record.business_logo_mimetype || "image/png",
        );
        businessLogoKey = key;
        await prisma.owner.update({
          where: { owner_id: owner.owner_id },
          data: { business_logo: key },
        });
        owner.business_logo = key;
      } catch (err) {
        console.error("Failed to upload business logo:", err);
        // Don't fail registration if logo upload fails
      }
    }

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
      owner: {
        ...owner,
        business_logo_url: businessLogoKey ? getS3Url(businessLogoKey) : null,
      },
    });
  } catch (error) {
    console.error("verifyRegistrationOtp error:", error);
    return sendError(res, 500, "SERVER_ERROR", "Failed to verify OTP.");
  }
}

export async function approveDevice(req, res) {
  try {
    const { token } = req.query;
    if (!token) {
      return res.status(400).send("<h1>Verification token is required.</h1>");
    }

    const verification = await prisma.deviceVerification.findUnique({
      where: { verification_token: token },
    });

    if (!verification) {
      return res
        .status(404)
        .send("<h1>Invalid or expired verification session.</h1>");
    }

    if (new Date() > verification.expires_at) {
      return res.status(400).send("<h1>Verification session has expired.</h1>");
    }

    // Flip status to approved
    await prisma.deviceVerification.update({
      where: { verification_token: token },
      data: { status: "approved" },
    });

    // Create trusted UserDevice
    const deviceName =
      verification.device_metadata?.model ||
      verification.device_metadata?.brand ||
      "Unknown Device";
    await prisma.userDevice.upsert({
      where: {
        owner_id_device_id: {
          owner_id: verification.owner_id,
          device_id: verification.device_id,
        },
      },
      update: {
        owner_id: verification.owner_id,
        device_name: deviceName,
        device_metadata: verification.device_metadata || {},
        ip_address:
          req.ip || req.headers["x-forwarded-for"] || req.socket.remoteAddress,
        user_agent: req.headers["user-agent"] || null,
        is_trusted: true,
        last_used_at: new Date(),
      },
      create: {
        device_id: verification.device_id,
        owner_id: verification.owner_id,
        device_name: deviceName,
        device_metadata: verification.device_metadata || {},
        ip_address:
          req.ip || req.headers["x-forwarded-for"] || req.socket.remoteAddress,
        user_agent: req.headers["user-agent"] || null,
        is_trusted: true,
      },
    });

    return res.status(200).send(`
      <div style="font-family: sans-serif; text-align: center; padding: 50px;">
        <h1 style="color: #28a745;">Device Approved successfully</h1>
        <p style="color: #555;">You may now return to the SmartInven app. You have been logged in automatically.</p>
      </div>
    `);
  } catch (err) {
    console.error("approveDevice error:", err);
    return res.status(500).send("<h1>Server error.</h1>");
  }
}

export async function denyDevice(req, res) {
  try {
    const { token } = req.query;
    if (!token) {
      return res.status(400).send("<h1>Verification token is required.</h1>");
    }

    const verification = await prisma.deviceVerification.findUnique({
      where: { verification_token: token },
    });

    if (!verification) {
      return res
        .status(404)
        .send("<h1>Invalid or expired verification session.</h1>");
    }

    // Flip status to denied
    await prisma.deviceVerification.update({
      where: { verification_token: token },
      data: { status: "denied" },
    });

    return res.status(200).send(`
      <div style="font-family: sans-serif; text-align: center; padding: 50px;">
        <h1 style="color: #dc3545;">Device Login Denied</h1>
        <p style="color: #555;">The login attempt from the untrusted device has been rejected and blocked.</p>
      </div>
    `);
  } catch (err) {
    console.error("denyDevice error:", err);
    return res.status(500).send("<h1>Server error.</h1>");
  }
}

export async function getDeviceVerificationStatus(req, res) {
  try {
    const { token } = req.query;
    if (!token) {
      return sendError(
        res,
        400,
        "VALIDATION_REQUIRED_FIELDS",
        "Verification token is required.",
      );
    }

    const verification = await prisma.deviceVerification.findUnique({
      where: { verification_token: token },
    });

    if (!verification) {
      return sendError(
        res,
        404,
        "SESSION_NOT_FOUND",
        "Verification session not found or expired.",
      );
    }

    if (new Date() > verification.expires_at) {
      // Auto cleanup expired session
      await prisma.deviceVerification
        .delete({
          where: { verification_token: token },
        })
        .catch(() => {});
      return sendError(
        res,
        410,
        "SESSION_EXPIRED",
        "Verification session has expired.",
      );
    }

    if (verification.status === "approved") {
      // Cleanup verification session
      await prisma.deviceVerification.delete({
        where: { verification_token: token },
      });

      const owner = await prisma.owner.findUnique({
        where: { owner_id: verification.owner_id },
        select: {
          owner_id: true,
          full_name: true,
          email: true,
          phone: true,
          package_id: true,
          status: true,
          two_factor_enabled: true,
          business_category: true,
          package: { select: { package_key: true, package_name: true } },
        },
      });

      // Check if 2FA is needed next
      if (owner.two_factor_enabled) {
        const otp = generateOtp();
        const otpHash = await hash(otp, 10);
        const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

        await prisma.twoFactorOtp.upsert({
          where: { owner_id: owner.owner_id },
          update: {
            otp_hash: otpHash,
            expires_at: expiresAt,
          },
          create: {
            owner_id: owner.owner_id,
            otp_hash: otpHash,
            expires_at: expiresAt,
          },
        });

        send2FaOtpEmail({
          to: owner.email,
          otp,
        }).catch(err => console.error("Failed to send 2FA OTP email:", err));

        const preAuthToken = sign(
          {
            owner_id: owner.owner_id,
            purpose: "2fa_verification",
          },
          process.env.JWT_SECRET,
          { expiresIn: "5m" }, // 5 minutes matching OTP
        );

        return sendSuccess(res, 200, {
          status: "approved",
          require_2fa: true,
          pre_auth_token: preAuthToken,
          device_id: verification.device_id,
          message: "Device approved. 2FA verification code sent to your email.",
        });
      }

      // Generate login JWT token
      const loginToken = generateToken({
        owner_id: owner.owner_id,
        email: owner.email,
        package_id: owner.package_id,
        package_key: owner.package?.package_key ?? null,
      });

      return sendSuccess(res, 200, {
        status: "approved",
        message: "Device approved. Login successful.",
        token: loginToken,
        device_id: verification.device_id,
        owner: {
          owner_id: owner.owner_id,
          full_name: owner.full_name,
          email: owner.email,
          phone: owner.phone,
          package_id: owner.package_id,
          business_category: owner.business_category,
          status: owner.status,
          package_key: owner.package?.package_key ?? null,
          package_name: owner.package?.package_name ?? null,
        },
      });
    }

    if (verification.status === "denied") {
      // Cleanup verification session
      await prisma.deviceVerification.delete({
        where: { verification_token: token },
      });

      return sendSuccess(res, 200, {
        status: "denied",
        message: "Device login request was denied.",
      });
    }

    // Still pending
    return sendSuccess(res, 200, {
      status: "pending",
      message: "Device verification is still pending approval.",
    });
  } catch (err) {
    console.error("getDeviceVerificationStatus error:", err);
    return sendError(res, 500, "SERVER_ERROR", "Failed to check status.");
  }
}

/* =========================
   VERIFY 2FA OTP
   ========================= */
export async function verify2FA(req, res) {
  try {
    const { pre_auth_token, code } = req.body;

    if (!pre_auth_token || !code) {
      return sendError(
        res,
        400,
        "VALIDATION_REQUIRED_FIELDS",
        "pre_auth_token and code are required.",
      );
    }

    let payload;
    try {
      payload = verify(pre_auth_token, process.env.JWT_SECRET);
    } catch (err) {
      return sendError(
        res,
        401,
        "INVALID_SESSION",
        "Session expired or invalid.",
      );
    }

    if (payload.purpose !== "2fa_verification") {
      return sendError(res, 400, "INVALID_SESSION", "Invalid session purpose.");
    }

    const owner = await prisma.owner.findUnique({
      where: { owner_id: payload.owner_id },
      select: {
        owner_id: true,
        full_name: true,
        email: true,
        phone: true,
        package_id: true,
        status: true,
        failed_2fa_attempts: true,
        locked_until: true,
        business_category: true,
        package: { select: { package_key: true, package_name: true } },
      },
    });

    if (!owner) {
      return sendError(res, 404, "OWNER_NOT_FOUND", "Owner not found.");
    }

    // Lockout check
    if (owner.locked_until && owner.locked_until > new Date()) {
      const minutesLeft = Math.ceil((owner.locked_until - new Date()) / 60000);
      return sendError(
        res,
        403,
        "ACCOUNT_LOCKED",
        `Account temporarily locked due to failed attempts. Try again in ${minutesLeft} minutes.`,
      );
    }

    const activeOtp = await prisma.twoFactorOtp.findUnique({
      where: { owner_id: owner.owner_id },
    });

    if (!activeOtp) {
      return sendError(
        res,
        401,
        "INVALID_SESSION",
        "No active login 2FA session found.",
      );
    }

    if (new Date() > activeOtp.expires_at) {
      return sendError(
        res,
        401,
        "OTP_EXPIRED",
        "Verification code has expired.",
      );
    }

    const isValid = await compare(code, activeOtp.otp_hash);

    if (!isValid) {
      const newFailedAttempts = owner.failed_2fa_attempts + 1;
      const updateData = { failed_2fa_attempts: newFailedAttempts };

      if (newFailedAttempts >= 5) {
        updateData.locked_until = new Date(Date.now() + 15 * 60 * 1000); // 15 mins
      }

      await prisma.owner.update({
        where: { owner_id: owner.owner_id },
        data: updateData,
      });

      return sendError(
        res,
        401,
        "INVALID_OTP",
        `Invalid 2FA code. ${Math.max(0, 5 - newFailedAttempts)} attempts remaining.`,
      );
    }

    // Success - clean up OTP record and reset lockout attempts
    await prisma.twoFactorOtp.delete({
      where: { owner_id: owner.owner_id },
    });

    await prisma.owner.update({
      where: { owner_id: owner.owner_id },
      data: {
        failed_2fa_attempts: 0,
        locked_until: null,
      },
    });

    const token = generateToken({
      owner_id: owner.owner_id,
      email: owner.email,
      package_id: owner.package_id,
      package_key: owner.package?.package_key ?? null,
    });

    return sendSuccess(res, 200, {
      message: "2FA verified. Login successful.",
      token,
      owner: {
        owner_id: owner.owner_id,
        full_name: owner.full_name,
        email: owner.email,
        phone: owner.phone,
        package_id: owner.package_id,
        business_category: owner.business_category,
        status: owner.status,
        package_key: owner.package?.package_key ?? null,
        package_name: owner.package?.package_name ?? null,
        two_factor_enabled: true,
      },
    });
  } catch (err) {
    console.error("verify2FA error:", err);
    return sendError(res, 500, "SERVER_ERROR", "Verification failed.");
  }
}

/* =========================
   2FA MANAGEMENT ENDPOINTS
   ========================= */

export async function setup2FA(req, res) {
  try {
    const ownerId = req.owner?.owner_id;
    if (!ownerId) {
      return sendError(res, 401, "AUTH_UNAUTHORIZED", "Unauthorized.");
    }

    const owner = await prisma.owner.findUnique({
      where: { owner_id: ownerId },
      select: { email: true },
    });

    const otp = generateOtp();
    const otpHash = await hash(otp, 10);
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    // Store in TwoFactorOtp table
    await prisma.twoFactorOtp.upsert({
      where: { owner_id: ownerId },
      update: {
        otp_hash: otpHash,
        expires_at: expiresAt,
      },
      create: {
        owner_id: ownerId,
        otp_hash: otpHash,
        expires_at: expiresAt,
      },
    });

    send2FaOtpEmail({
      to: owner.email,
      otp,
    }).catch(err => console.error("Failed to send 2FA setup OTP email:", err));

    return sendSuccess(res, 200, {
      message: "Verification code sent to your email.",
      secret: "email_setup",
    });
  } catch (err) {
    console.error("setup2FA error:", err);
    return sendError(
      res,
      500,
      "SERVER_ERROR",
      "Failed to generate 2FA setup details.",
    );
  }
}

export async function enable2FA(req, res) {
  try {
    const ownerId = req.owner?.owner_id;
    const { code } = req.body;

    if (!ownerId) {
      return sendError(res, 401, "AUTH_UNAUTHORIZED", "Unauthorized.");
    }

    if (!code) {
      return sendError(
        res,
        400,
        "VALIDATION_REQUIRED_FIELDS",
        "Verification code is required.",
      );
    }

    const activeOtp = await prisma.twoFactorOtp.findUnique({
      where: { owner_id: ownerId },
    });

    if (!activeOtp) {
      return sendError(
        res,
        400,
        "INVALID_SESSION",
        "Please request a new verification code first.",
      );
    }

    if (new Date() > activeOtp.expires_at) {
      return sendError(
        res,
        401,
        "OTP_EXPIRED",
        "Verification code has expired.",
      );
    }

    const isValid = await compare(code, activeOtp.otp_hash);
    if (!isValid) {
      return sendError(res, 401, "INVALID_OTP", "Invalid verification code.");
    }

    // Success - clean up OTP record and enable 2FA
    await prisma.twoFactorOtp.delete({
      where: { owner_id: ownerId },
    });

    await prisma.owner.update({
      where: { owner_id: ownerId },
      data: {
        two_factor_enabled: true,
      },
    });

    return sendSuccess(res, 200, {
      message: "Two-factor authentication enabled successfully.",
    });
  } catch (err) {
    console.error("enable2FA error:", err);
    return sendError(res, 500, "SERVER_ERROR", "Failed to enable 2FA.");
  }
}

export async function sendDisable2FAOtp(req, res) {
  try {
    const ownerId = req.owner?.owner_id;
    if (!ownerId) {
      return sendError(res, 401, "AUTH_UNAUTHORIZED", "Unauthorized.");
    }

    const owner = await prisma.owner.findUnique({
      where: { owner_id: ownerId },
      select: { email: true, two_factor_enabled: true },
    });

    if (!owner.two_factor_enabled) {
      return sendError(
        res,
        400,
        "2FA_ALREADY_DISABLED",
        "2FA is not enabled for this account.",
      );
    }

    const otp = generateOtp();
    const otpHash = await hash(otp, 10);
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    // Store in TwoFactorOtp table
    await prisma.twoFactorOtp.upsert({
      where: { owner_id: ownerId },
      update: {
        otp_hash: otpHash,
        expires_at: expiresAt,
      },
      create: {
        owner_id: ownerId,
        otp_hash: otpHash,
        expires_at: expiresAt,
      },
    });

    send2FaOtpEmail({
      to: owner.email,
      otp,
    }).catch(err => console.error("Failed to send 2FA disable OTP email:", err));

    return sendSuccess(res, 200, {
      message: "Verification code sent to your email.",
    });
  } catch (err) {
    console.error("sendDisable2FAOtp error:", err);
    return sendError(
      res,
      500,
      "SERVER_ERROR",
      "Failed to send verification code.",
    );
  }
}

export async function disable2FA(req, res) {
  try {
    const ownerId = req.owner?.owner_id;
    const { code } = req.body;

    if (!ownerId) {
      return sendError(res, 401, "AUTH_UNAUTHORIZED", "Unauthorized.");
    }

    if (!code) {
      return sendError(
        res,
        400,
        "VALIDATION_REQUIRED_FIELDS",
        "Verification code is required.",
      );
    }

    const owner = await prisma.owner.findUnique({
      where: { owner_id: ownerId },
      select: { two_factor_enabled: true },
    });

    const activeOtp = await prisma.twoFactorOtp.findUnique({
      where: { owner_id: ownerId },
    });

    if (!owner.two_factor_enabled || !activeOtp) {
      return sendError(
        res,
        400,
        "INVALID_SESSION",
        "Please request to disable 2FA first to receive a verification code.",
      );
    }

    if (new Date() > activeOtp.expires_at) {
      return sendError(
        res,
        401,
        "OTP_EXPIRED",
        "Verification code has expired.",
      );
    }

    const isValid = await compare(code, activeOtp.otp_hash);
    if (!isValid) {
      return sendError(res, 401, "INVALID_OTP", "Invalid verification code.");
    }

    // Success - clean up OTP record and disable 2FA
    await prisma.twoFactorOtp.delete({
      where: { owner_id: ownerId },
    });

    await prisma.owner.update({
      where: { owner_id: ownerId },
      data: {
        two_factor_enabled: false,
      },
    });

    return sendSuccess(res, 200, {
      message: "Two-factor authentication disabled successfully.",
    });
  } catch (err) {
    console.error("disable2FA error:", err);
    return sendError(res, 500, "SERVER_ERROR", "Failed to disable 2FA.");
  }
}

const client = new OAuth2Client(
  process.env.GOOGLE_WEB_CLIENT_ID || process.env.GOOGLE_CLIENT_ID,
);

// export async function googleLogin(req, res) {
//   try {
//     const {
//       idToken,
//       fcm_token,
//       package_key,
//       phone,
//       business_name,
//       business_category,
//       pan_number,
//     } = req.body;

//     if (!idToken) {
//       return sendError(
//         res,
//         400,
//         "VALIDATION_REQUIRED_FIELDS",
//         "Google ID token is required.",
//       );
//     }

//     // Verify Google ID Token
//     let ticket;
//     try {
//       ticket = await client.verifyIdToken({
//         idToken,
//         audience:
//           process.env.GOOGLE_WEB_CLIENT_ID || process.env.GOOGLE_CLIENT_ID,
//       });
//     } catch (err) {
//       return sendError(
//         res,
//         400,
//         "INVALID_TOKEN",
//         "Failed to verify Google token.",
//         { detail: err?.message },
//       );
//     }

//     const payload = ticket.getPayload();
//     if (!payload || !payload.email) {
//       return sendError(
//         res,
//         400,
//         "INVALID_TOKEN",
//         "Failed to retrieve email from Google token.",
//       );
//     }

//     const googleId = payload.sub;
//     const email = normalizeEmail(payload.email);
//     const fullName = payload.name || "";

//     // 1. Check if owner exists by google_id
//     const existingGoogleOwner = await prisma.owner.findUnique({
//       where: { google_id: googleId },
//       select: {
//         owner_id: true,
//         full_name: true,
//         email: true,
//         phone: true,
//         package_id: true,
//         business_category: true,
//         business_name: true,
//         status: true,
//         created_at: true,
//         subscription_expires_at: true,
//         trial_expires_at: true,
//         two_factor_enabled: true,
//         package: { select: { package_key: true, package_name: true } },
//       },
//     });

//     if (existingGoogleOwner) {
//       // Check account status before allowing login
//       if (existingGoogleOwner.status === "inactive") {
//         const pendingPayment = await prisma.paymentProof.findFirst({
//           where: {
//             owner_id: existingGoogleOwner.owner_id,
//             status: "pending",
//           },
//         });

//         if (pendingPayment) {
//           return sendError(
//             res,
//             403,
//             "PAYMENT_PENDING",
//             "Your payment proof is under review. Please wait for approval.",
//             {
//               owner: {
//                 owner_id: existingGoogleOwner.owner_id,
//                 full_name: existingGoogleOwner.full_name,
//                 email: existingGoogleOwner.email,
//                 phone: existingGoogleOwner.phone,
//                 package_id: existingGoogleOwner.package_id,
//                 status: existingGoogleOwner.status,
//                 package_key: existingGoogleOwner.package?.package_key ?? null,
//                 package_name: existingGoogleOwner.package?.package_name ?? null,
//               },
//             },
//           );
//         }

//         if (
//           existingGoogleOwner.subscription_expires_at &&
//           new Date(existingGoogleOwner.subscription_expires_at) < new Date()
//         ) {
//           return sendError(
//             res,
//             403,
//             "SUBSCRIPTION_EXPIRED",
//             "Your subscription has expired. Please renew to continue.",
//             {
//               owner: {
//                 owner_id: existingGoogleOwner.owner_id,
//                 full_name: existingGoogleOwner.full_name,
//                 email: existingGoogleOwner.email,
//                 phone: existingGoogleOwner.phone,
//                 package_id: existingGoogleOwner.package_id,
//                 status: existingGoogleOwner.status,
//                 package_key: existingGoogleOwner.package?.package_key ?? null,
//                 package_name: existingGoogleOwner.package?.package_name ?? null,
//               },
//             },
//           );
//         }
//       }

//       if (existingGoogleOwner.status === "trial") {
//         // First check if there's a pending payment (user chose yearly plan and uploaded payment)
//         const pendingPayment = await prisma.paymentProof.findFirst({
//           where: { owner_id: existingGoogleOwner.owner_id, status: "pending" },
//           select: { id: true },
//         });

//         if (pendingPayment) {
//           return sendError(
//             res,
//             403,
//             "PAYMENT_PENDING",
//             "Your payment proof is under review. Please wait for approval.",
//             {
//               owner: {
//                 owner_id: existingGoogleOwner.owner_id,
//                 full_name: existingGoogleOwner.full_name,
//                 email: existingGoogleOwner.email,
//                 phone: existingGoogleOwner.phone,
//                 package_id: existingGoogleOwner.package_id,
//                 status: existingGoogleOwner.status,
//                 package_key: existingGoogleOwner.package?.package_key ?? null,
//                 package_name: existingGoogleOwner.package?.package_name ?? null,
//               },
//             },
//           );
//         }

//         // No pending payment - check if trial has expired (read directly from DB)
//         if (
//           existingGoogleOwner.trial_expires_at &&
//           new Date() > new Date(existingGoogleOwner.trial_expires_at)
//         ) {
//           return sendError(
//             res,
//             403,
//             "TRIAL_EXPIRED",
//             "Your 30-day trial has expired. Please subscribe to continue.",
//             {
//               owner: {
//                 owner_id: existingGoogleOwner.owner_id,
//                 full_name: existingGoogleOwner.full_name,
//                 email: existingGoogleOwner.email,
//                 phone: existingGoogleOwner.phone,
//                 package_id: existingGoogleOwner.package_id,
//                 status: existingGoogleOwner.status,
//                 package_key: existingGoogleOwner.package?.package_key ?? null,
//                 package_name: existingGoogleOwner.package?.package_name ?? null,
//               },
//             },
//           );
//         }
//       }

//       // Active subscription expiry check (was previously only checked under "inactive")
//       if (existingGoogleOwner.status === "active") {
//         if (
//           existingGoogleOwner.subscription_expires_at &&
//           new Date(existingGoogleOwner.subscription_expires_at) < new Date()
//         ) {
//           return sendError(
//             res,
//             403,
//             "SUBSCRIPTION_EXPIRED",
//             "Your subscription has expired. Please renew to continue.",
//             {
//               owner: {
//                 owner_id: existingGoogleOwner.owner_id,
//                 full_name: existingGoogleOwner.full_name,
//                 email: existingGoogleOwner.email,
//                 phone: existingGoogleOwner.phone,
//                 package_id: existingGoogleOwner.package_id,
//                 status: existingGoogleOwner.status,
//                 package_key: existingGoogleOwner.package?.package_key ?? null,
//                 package_name: existingGoogleOwner.package?.package_name ?? null,
//               },
//             },
//           );
//         }
//       }

//       // Pure login: Update fcm_token if provided
//       if (fcm_token) {
//         await prisma.owner.update({
//           where: { owner_id: existingGoogleOwner.owner_id },
//           data: { fcm_token },
//         });
//       }

//       const token = generateToken({
//         owner_id: existingGoogleOwner.owner_id,
//         email: existingGoogleOwner.email,
//         package_id: existingGoogleOwner.package_id,
//         package_key: existingGoogleOwner.package?.package_key ?? null,
//       });

//       return sendSuccess(res, 200, {
//         message: "Login successful.",
//         token,
//         owner: {
//           owner_id: existingGoogleOwner.owner_id,
//           full_name: existingGoogleOwner.full_name,
//           email: existingGoogleOwner.email,
//           phone: existingGoogleOwner.phone,
//           package_id: existingGoogleOwner.package_id,
//           business_category: existingGoogleOwner.business_category,
//           business_name: existingGoogleOwner.business_name,
//           status: existingGoogleOwner.status,
//           package_key: existingGoogleOwner.package?.package_key ?? null,
//           package_name: existingGoogleOwner.package?.package_name ?? null,
//           two_factor_enabled: existingGoogleOwner.two_factor_enabled,
//         },
//       });
//     }

//     // 2. Google ID not found. Check if email collision blocks register.
//     const existingEmailOwner = await prisma.owner.findUnique({
//       where: { email },
//       select: {
//         owner_id: true,
//         auth_provider: true,
//         google_id: true,
//         full_name: true,
//         phone: true,
//         package_id: true,
//         business_category: true,
//         business_name: true,
//         status: true,
//         created_at: true,
//         subscription_expires_at: true,
//         two_factor_enabled: true,
//         package: { select: { package_key: true, package_name: true } },
//       },
//     });

//     if (existingEmailOwner) {
//       const isGoogleLinked = existingEmailOwner.auth_provider === "google";

//       if (isGoogleLinked) {
//         // Check if it's the same Google account
//         if (existingEmailOwner.google_id === googleId) {
//           // Same Google account, allow login
//           // Update fcm_token if provided
//           if (fcm_token) {
//             await prisma.owner.update({
//               where: { owner_id: existingEmailOwner.owner_id },
//               data: { fcm_token },
//             });
//           }

//           const token = generateToken({
//             owner_id: existingEmailOwner.owner_id,
//             email: existingEmailOwner.email,
//             package_id: existingEmailOwner.package_id,
//             package_key: existingEmailOwner.package?.package_key ?? null,
//           });

//           return sendSuccess(res, 200, {
//             message: "Login successful.",
//             token,
//             owner: {
//               owner_id: existingEmailOwner.owner_id,
//               full_name: existingEmailOwner.full_name,
//               email: existingEmailOwner.email,
//               phone: existingEmailOwner.phone,
//               package_id: existingEmailOwner.package_id,
//               business_category: existingEmailOwner.business_category,
//               business_name: existingEmailOwner.business_name,
//               status: existingEmailOwner.status,
//               package_key: existingEmailOwner.package?.package_key ?? null,
//               package_name: existingEmailOwner.package?.package_name ?? null,
//               two_factor_enabled: existingEmailOwner.two_factor_enabled,
//             },
//           });
//         } else {
//           // Different Google account with same email
//           return sendError(
//             res,
//             409,
//             "EMAIL_ALREADY_EXISTS",
//             "This email is already linked to a different Google account. Please log in with that account.",
//           );
//         }
//       } else {
//         // Local account exists - should use email/password login
//         return sendError(
//           res,
//           409,
//           "LOCAL_ACCOUNT",
//           "This email is already registered with a password. Please log in with your email and password.",
//         );
//       }
//     }

//     // 3. Brand new user. Check if registration info is supplied.
//     if (!package_key && !phone && !business_name) {
//       return sendSuccess(res, 200, {
//         requires_additional_info: true,
//         prefill: {
//           email,
//           full_name: fullName,
//         },
//         required_fields: ["package_key", "phone", "business_name"],
//         optional_fields: ["business_category"],
//       });
//     }

//     // If some but not all required fields are provided
//     if (!package_key || !phone || !business_name) {
//       return sendError(
//         res,
//         400,
//         "VALIDATION_REQUIRED_FIELDS",
//         "package_key, phone, and business_name are required for registration.",
//       );
//     }

//     // Validate package_key
//     const cleanedPackageKey = String(package_key).trim().toLowerCase();
//     const allowedPackages = new Set([
//       "hardware",
//       "clothing",
//       "grocery",
//       "store",
//     ]);
//     if (!allowedPackages.has(cleanedPackageKey)) {
//       return sendError(
//         res,
//         400,
//         "VALIDATION_PACKAGE_INVALID",
//         "Invalid package key.",
//       );
//     }

//     // Validate phone number format (must be 10 digits)
//     const phoneError = validatePhone(phone);
//     if (phoneError) {
//       return sendError(res, 400, "VALIDATION_PHONE_INVALID", phoneError);
//     }

//     // Validate PAN number format, only if provided (optional field)
//     const cleanedPanNumber =
//       pan_number !== undefined && pan_number !== null
//         ? String(pan_number).trim()
//         : "";
//     const panError = cleanedPanNumber ? validatePan(cleanedPanNumber) : null;
//     if (panError) {
//       return sendError(res, 400, "VALIDATION_PAN_INVALID", panError);
//     }

//     // Check if phone number already exists
//     const existingPhoneOwner = await prisma.owner.findUnique({
//       where: { phone },
//     });
//     if (existingPhoneOwner) {
//       return sendError(
//         res,
//         409,
//         "PHONE_ALREADY_EXISTS",
//         "Phone number is already registered.",
//       );
//     }

//     // Check if PAN number already exists, only if provided
//     const existingPanOwner = cleanedPanNumber
//       ? await prisma.owner.findUnique({
//           where: { pan_number: cleanedPanNumber },
//         })
//       : null;
//     if (existingPanOwner) {
//       return sendError(
//         res,
//         409,
//         "PAN_ALREADY_EXISTS",
//         "PAN number is already registered.",
//       );
//     }

//     // Get or create Package
//     let pkg = await prisma.package.findUnique({
//       where: { package_key: cleanedPackageKey },
//     });
//     if (!pkg) {
//       pkg = await prisma.package.create({
//         data: {
//           package_key: cleanedPackageKey,
//           package_name: packageNameMap[cleanedPackageKey] || cleanedPackageKey,
//         },
//       });
//     }

//     // Business category defaults
//     let finalBusinessCategory = business_category
//       ? String(business_category).trim()
//       : null;
//     if (!finalBusinessCategory) {
//       if (cleanedPackageKey === "grocery")
//         finalBusinessCategory = "Grocery Store";
//       else if (cleanedPackageKey === "clothing")
//         finalBusinessCategory = "Clothing Store";
//       else if (cleanedPackageKey === "hardware")
//         finalBusinessCategory = "Hardware Store";
//       else if (cleanedPackageKey === "store") finalBusinessCategory = "Store";
//     }

//     // Create owner (password is null for Google sign-in users)
//     const newOwner = await prisma.owner.create({
//       data: {
//         full_name: fullName,
//         phone,
//         email,
//         password: null,
//         google_id: googleId,
//         auth_provider: "google",
//         package_id: pkg.package_id,
//         business_category: finalBusinessCategory,
//         business_name: String(business_name).trim(),
//         pan_number: cleanedPanNumber || null,
//         status: "trial",
//         trial_expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30-day trial
//         fcm_token: fcm_token || null,
//       },
//       select: {
//         owner_id: true,
//         full_name: true,
//         email: true,
//         phone: true,
//         package_id: true,
//         business_category: true,
//         business_name: true,
//         pan_number: true,
//         status: true,
//         trial_expires_at: true,
//         two_factor_enabled: true,
//         package: { select: { package_key: true, package_name: true } },
//       },
//     });

//     // Seed default store category for store package
//     if (cleanedPackageKey === "store") {
//       try {
//         await prisma.storeCategory.create({
//           data: {
//             owner_id: newOwner.owner_id,
//             category_name: "general",
//           },
//         });
//       } catch (err) {
//         console.error("Failed to create default store category:", err);
//       }
//     }

//     // Generate JWT token
//     const token = generateToken({
//       owner_id: newOwner.owner_id,
//       email: newOwner.email,
//       package_id: newOwner.package_id,
//       package_key: newOwner.package?.package_key ?? null,
//     });

//     return sendSuccess(res, 201, {
//       message: "Registration successful.",
//       token,
//       owner: {
//         owner_id: newOwner.owner_id,
//         full_name: newOwner.full_name,
//         email: newOwner.email,
//         phone: newOwner.phone,
//         package_id: newOwner.package_id,
//         business_category: newOwner.business_category,
//         business_name: newOwner.business_name,
//         pan_number: newOwner.pan_number,
//         status: newOwner.status,
//         package_key: newOwner.package?.package_key ?? null,
//         package_name: newOwner.package?.package_name ?? null,
//         two_factor_enabled: newOwner.two_factor_enabled,
//       },
//     });
//   } catch (err) {
//     console.error("Google Sign-In Error:", err);
//     return sendError(res, 500, "SERVER_ERROR", "Google login failed.", {
//       detail: err?.message ?? "An unexpected error occurred.",
//     });
//   }
// }
export async function googleLogin(req, res) {
  try {
    const {
      idToken,
      fcm_token,
      package_key,
      phone,
      business_name,
      business_category,
      pan_number,
    } = req.body;

    if (!idToken) {
      return sendError(
        res,
        400,
        "VALIDATION_REQUIRED_FIELDS",
        "Google ID token is required.",
      );
    }

    // Verify Google ID Token
    let ticket;
    try {
      ticket = await client.verifyIdToken({
        idToken,
        audience:
          process.env.GOOGLE_WEB_CLIENT_ID || process.env.GOOGLE_CLIENT_ID,
      });
    } catch (err) {
      return sendError(
        res,
        400,
        "INVALID_TOKEN",
        "Failed to verify Google token.",
        { detail: err?.message },
      );
    }

    const payload = ticket.getPayload();
    if (!payload || !payload.email) {
      return sendError(
        res,
        400,
        "INVALID_TOKEN",
        "Failed to retrieve email from Google token.",
      );
    }

    const googleId = payload.sub;
    const email = normalizeEmail(payload.email);
    const fullName = payload.name || "";

    // 1. Check if owner exists by google_id
    const existingGoogleOwner = await prisma.owner.findUnique({
      where: { google_id: googleId },
      select: {
        owner_id: true,
        full_name: true,
        email: true,
        phone: true,
        package_id: true,
        business_category: true,
        business_name: true,
        status: true,
        created_at: true,
        subscription_expires_at: true,
        trial_expires_at: true,
        two_factor_enabled: true,
        package: { select: { package_key: true, package_name: true } },
      },
    });

    if (existingGoogleOwner) {
      // Check account status before allowing login
      if (existingGoogleOwner.status === "inactive") {
        const pendingPayment = await prisma.paymentProof.findFirst({
          where: {
            owner_id: existingGoogleOwner.owner_id,
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
                owner_id: existingGoogleOwner.owner_id,
                full_name: existingGoogleOwner.full_name,
                email: existingGoogleOwner.email,
                phone: existingGoogleOwner.phone,
                package_id: existingGoogleOwner.package_id,
                status: existingGoogleOwner.status,
                package_key: existingGoogleOwner.package?.package_key ?? null,
                package_name: existingGoogleOwner.package?.package_name ?? null,
              },
            },
          );
        }

        if (
          existingGoogleOwner.subscription_expires_at &&
          new Date(existingGoogleOwner.subscription_expires_at) < new Date()
        ) {
          return sendError(
            res,
            403,
            "SUBSCRIPTION_EXPIRED",
            "Your subscription has expired. Please renew to continue.",
            {
              owner: {
                owner_id: existingGoogleOwner.owner_id,
                full_name: existingGoogleOwner.full_name,
                email: existingGoogleOwner.email,
                phone: existingGoogleOwner.phone,
                package_id: existingGoogleOwner.package_id,
                status: existingGoogleOwner.status,
                package_key: existingGoogleOwner.package?.package_key ?? null,
                package_name: existingGoogleOwner.package?.package_name ?? null,
              },
            },
          );
        }
      }

      if (existingGoogleOwner.status === "trial") {
        // Check if trial has expired (read directly from DB)
        if (
          existingGoogleOwner.trial_expires_at &&
          new Date() > new Date(existingGoogleOwner.trial_expires_at)
        ) {
          return sendError(
            res,
            403,
            "TRIAL_EXPIRED",
            "Your 30-day trial has expired. Please subscribe to continue.",
            {
              owner: {
                owner_id: existingGoogleOwner.owner_id,
                full_name: existingGoogleOwner.full_name,
                email: existingGoogleOwner.email,
                phone: existingGoogleOwner.phone,
                package_id: existingGoogleOwner.package_id,
                status: existingGoogleOwner.status,
                package_key: existingGoogleOwner.package?.package_key ?? null,
                package_name: existingGoogleOwner.package?.package_name ?? null,
              },
            },
          );
        }
      }

      // Active subscription expiry check (was previously only checked under "inactive")
      if (existingGoogleOwner.status === "active") {
        if (
          existingGoogleOwner.subscription_expires_at &&
          new Date(existingGoogleOwner.subscription_expires_at) < new Date()
        ) {
          return sendError(
            res,
            403,
            "SUBSCRIPTION_EXPIRED",
            "Your subscription has expired. Please renew to continue.",
            {
              owner: {
                owner_id: existingGoogleOwner.owner_id,
                full_name: existingGoogleOwner.full_name,
                email: existingGoogleOwner.email,
                phone: existingGoogleOwner.phone,
                package_id: existingGoogleOwner.package_id,
                status: existingGoogleOwner.status,
                package_key: existingGoogleOwner.package?.package_key ?? null,
                package_name: existingGoogleOwner.package?.package_name ?? null,
              },
            },
          );
        }
      }

      // Pure login: Update fcm_token if provided
      if (fcm_token) {
        await prisma.owner.update({
          where: { owner_id: existingGoogleOwner.owner_id },
          data: { fcm_token },
        });
      }

      const token = generateToken({
        owner_id: existingGoogleOwner.owner_id,
        email: existingGoogleOwner.email,
        package_id: existingGoogleOwner.package_id,
        package_key: existingGoogleOwner.package?.package_key ?? null,
      });

      return sendSuccess(res, 200, {
        message: "Login successful.",
        token,
        owner: {
          owner_id: existingGoogleOwner.owner_id,
          full_name: existingGoogleOwner.full_name,
          email: existingGoogleOwner.email,
          phone: existingGoogleOwner.phone,
          package_id: existingGoogleOwner.package_id,
          business_category: existingGoogleOwner.business_category,
          business_name: existingGoogleOwner.business_name,
          status: existingGoogleOwner.status,
          package_key: existingGoogleOwner.package?.package_key ?? null,
          package_name: existingGoogleOwner.package?.package_name ?? null,
          two_factor_enabled: existingGoogleOwner.two_factor_enabled,
        },
      });
    }

    // 2. Google ID not found. Check if email collision blocks register.
    const existingEmailOwner = await prisma.owner.findUnique({
      where: { email },
      select: {
        owner_id: true,
        auth_provider: true,
        google_id: true,
        full_name: true,
        phone: true,
        package_id: true,
        business_category: true,
        business_name: true,
        status: true,
        created_at: true,
        subscription_expires_at: true,
        two_factor_enabled: true,
        package: { select: { package_key: true, package_name: true } },
      },
    });

    if (existingEmailOwner) {
      const isGoogleLinked = existingEmailOwner.auth_provider === "google";

      if (isGoogleLinked) {
        // Check if it's the same Google account
        if (existingEmailOwner.google_id === googleId) {
          // Same Google account, allow login
          // Update fcm_token if provided
          if (fcm_token) {
            await prisma.owner.update({
              where: { owner_id: existingEmailOwner.owner_id },
              data: { fcm_token },
            });
          }

          const token = generateToken({
            owner_id: existingEmailOwner.owner_id,
            email: existingEmailOwner.email,
            package_id: existingEmailOwner.package_id,
            package_key: existingEmailOwner.package?.package_key ?? null,
          });

          return sendSuccess(res, 200, {
            message: "Login successful.",
            token,
            owner: {
              owner_id: existingEmailOwner.owner_id,
              full_name: existingEmailOwner.full_name,
              email: existingEmailOwner.email,
              phone: existingEmailOwner.phone,
              package_id: existingEmailOwner.package_id,
              business_category: existingEmailOwner.business_category,
              business_name: existingEmailOwner.business_name,
              status: existingEmailOwner.status,
              package_key: existingEmailOwner.package?.package_key ?? null,
              package_name: existingEmailOwner.package?.package_name ?? null,
              two_factor_enabled: existingEmailOwner.two_factor_enabled,
            },
          });
        } else {
          // Different Google account with same email
          return sendError(
            res,
            409,
            "EMAIL_ALREADY_EXISTS",
            "This email is already linked to a different Google account. Please log in with that account.",
          );
        }
      } else {
        // Local account exists - should use email/password login
        return sendError(
          res,
          409,
          "LOCAL_ACCOUNT",
          "This email is already registered with a password. Please log in with your email and password.",
        );
      }
    }

    // 3. Brand new user. Check if registration info is supplied.
    if (!package_key && !phone && !business_name) {
      return sendSuccess(res, 200, {
        requires_additional_info: true,
        prefill: {
          email,
          full_name: fullName,
        },
        required_fields: ["package_key", "phone", "business_name"],
        optional_fields: ["business_category"],
      });
    }

    // If some but not all required fields are provided
    if (!package_key || !phone || !business_name) {
      return sendError(
        res,
        400,
        "VALIDATION_REQUIRED_FIELDS",
        "package_key, phone, and business_name are required for registration.",
      );
    }

    // Validate package_key
    const cleanedPackageKey = String(package_key).trim().toLowerCase();
    const allowedPackages = new Set([
      "hardware",
      "clothing",
      "grocery",
      "store",
    ]);
    if (!allowedPackages.has(cleanedPackageKey)) {
      return sendError(
        res,
        400,
        "VALIDATION_PACKAGE_INVALID",
        "Invalid package key.",
      );
    }

    // Validate phone number format (must be 10 digits)
    const phoneError = validatePhone(phone);
    if (phoneError) {
      return sendError(res, 400, "VALIDATION_PHONE_INVALID", phoneError);
    }

    // Validate PAN number format, only if provided (optional field)
    const cleanedPanNumber =
      pan_number !== undefined && pan_number !== null
        ? String(pan_number).trim()
        : "";
    const panError = cleanedPanNumber ? validatePan(cleanedPanNumber) : null;
    if (panError) {
      return sendError(res, 400, "VALIDATION_PAN_INVALID", panError);
    }

    // Check if phone number already exists
    const existingPhoneOwner = await prisma.owner.findUnique({
      where: { phone },
    });
    if (existingPhoneOwner) {
      return sendError(
        res,
        409,
        "PHONE_ALREADY_EXISTS",
        "Phone number is already registered.",
      );
    }

    // Check if PAN number already exists, only if provided
    const existingPanOwner = cleanedPanNumber
      ? await prisma.owner.findUnique({
          where: { pan_number: cleanedPanNumber },
        })
      : null;
    if (existingPanOwner) {
      return sendError(
        res,
        409,
        "PAN_ALREADY_EXISTS",
        "PAN number is already registered.",
      );
    }

    // Get or create Package
    let pkg = await prisma.package.findUnique({
      where: { package_key: cleanedPackageKey },
    });
    if (!pkg) {
      pkg = await prisma.package.create({
        data: {
          package_key: cleanedPackageKey,
          package_name: packageNameMap[cleanedPackageKey] || cleanedPackageKey,
        },
      });
    }

    // Business category defaults
    let finalBusinessCategory = business_category
      ? String(business_category).trim()
      : null;
    if (!finalBusinessCategory) {
      if (cleanedPackageKey === "grocery")
        finalBusinessCategory = "Grocery Store";
      else if (cleanedPackageKey === "clothing")
        finalBusinessCategory = "Clothing Store";
      else if (cleanedPackageKey === "hardware")
        finalBusinessCategory = "Hardware Store";
      else if (cleanedPackageKey === "store") finalBusinessCategory = "Store";
    }

    // Create owner (password is null for Google sign-in users)
    const newOwner = await prisma.owner.create({
      data: {
        full_name: fullName,
        phone,
        email,
        password: null,
        google_id: googleId,
        auth_provider: "google",
        package_id: pkg.package_id,
        business_category: finalBusinessCategory,
        business_name: String(business_name).trim(),
        pan_number: cleanedPanNumber || null,
        status: "trial",
        trial_expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30-day trial
        fcm_token: fcm_token || null,
      },
      select: {
        owner_id: true,
        full_name: true,
        email: true,
        phone: true,
        package_id: true,
        business_category: true,
        business_name: true,
        pan_number: true,
        status: true,
        trial_expires_at: true,
        two_factor_enabled: true,
        package: { select: { package_key: true, package_name: true } },
      },
    });

    // Seed default store category for store package
    if (cleanedPackageKey === "store") {
      try {
        await prisma.storeCategory.create({
          data: {
            owner_id: newOwner.owner_id,
            category_name: "general",
          },
        });
      } catch (err) {
        console.error("Failed to create default store category:", err);
      }
    }

    // Generate JWT token
    const token = generateToken({
      owner_id: newOwner.owner_id,
      email: newOwner.email,
      package_id: newOwner.package_id,
      package_key: newOwner.package?.package_key ?? null,
    });

    return sendSuccess(res, 201, {
      message: "Registration successful.",
      token,
      owner: {
        owner_id: newOwner.owner_id,
        full_name: newOwner.full_name,
        email: newOwner.email,
        phone: newOwner.phone,
        package_id: newOwner.package_id,
        business_category: newOwner.business_category,
        business_name: newOwner.business_name,
        pan_number: newOwner.pan_number,
        status: newOwner.status,
        package_key: newOwner.package?.package_key ?? null,
        package_name: newOwner.package?.package_name ?? null,
        two_factor_enabled: newOwner.two_factor_enabled,
      },
    });
  } catch (err) {
    console.error("Google Sign-In Error:", err);
    return sendError(res, 500, "SERVER_ERROR", "Google login failed.", {
      detail: err?.message ?? "An unexpected error occurred.",
    });
  }
}

/* =========================
   DEVICE MANAGEMENT
   ========================= */
export async function getDevices(req, res) {
  try {
    const ownerId = req.owner?.owner_id;
    if (!ownerId) {
      return sendError(res, 401, "AUTH_UNAUTHORIZED", "Unauthorized.");
    }

    const devices = await prisma.userDevice.findMany({
      where: { owner_id: ownerId },
      select: {
        device_id: true,
        device_name: true,
        ip_address: true,
        user_agent: true,
        is_trusted: true,
        created_at: true,
        last_used_at: true,
      },
      orderBy: { last_used_at: "desc" },
    });

    return sendSuccess(res, 200, { devices });
  } catch (err) {
    console.error("getDevices error:", err);
    return sendError(res, 500, "SERVER_ERROR", "Failed to fetch devices.");
  }
}

export async function deleteDevice(req, res) {
  try {
    const ownerId = req.owner?.owner_id;
    const { device_id } = req.params;

    if (!ownerId) {
      return sendError(res, 401, "AUTH_UNAUTHORIZED", "Unauthorized.");
    }

    if (!device_id) {
      return sendError(
        res,
        400,
        "VALIDATION_REQUIRED_FIELDS",
        "device_id is required.",
      );
    }

    // Find device first to ensure owner owns it
    const device = await prisma.userDevice.findUnique({
      where: { owner_id_device_id: { owner_id: ownerId, device_id } },
    });

    if (!device) {
      return sendError(
        res,
        404,
        "DEVICE_NOT_FOUND",
        "Device not found or not owned by you.",
      );
    }

    await prisma.userDevice.delete({
      where: { owner_id_device_id: { owner_id: ownerId, device_id } },
    });

    return sendSuccess(res, 200, {
      message: "Device access revoked successfully.",
    });
  } catch (err) {
    console.error("deleteDevice error:", err);
    return sendError(
      res,
      500,
      "SERVER_ERROR",
      "Failed to revoke device access.",
    );
  }
}

export async function logout(req, res) {
  try {
    const ownerId = req.owner?.owner_id;
    const { fcm_token } = req.body;

    if (!ownerId) {
      return sendError(res, 401, "AUTH_UNAUTHORIZED", "Unauthorized.");
    }

    // Only clear if it matches what's currently stored, so logging out
    // on one device doesn't wipe another device's active token
    await prisma.owner.updateMany({
      where: {
        owner_id: ownerId,
        ...(fcm_token ? { fcm_token } : {}),
      },
      data: { fcm_token: null },
    });

    return sendSuccess(res, 200, { message: "Logged out successfully." });
  } catch (err) {
    console.error("logout error:", err);
    return sendError(res, 500, "SERVER_ERROR", "Logout failed.");
  }
}