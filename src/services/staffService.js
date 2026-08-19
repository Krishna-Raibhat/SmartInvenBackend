// src/services/staffService.js
import { hash, compare } from "bcrypt";
import jwt from "jsonwebtoken";
import { prisma } from "../prisma/client.js";
import { toNPTISOString } from "../utils/nptTime.js";
import { sendOtpEmail } from "../utils/mailer.js";

const { sign, verify } = jwt;

const STAFF_SELECT = {
  staff_id: true,
  owner_id: true,
  full_name: true,
  email: true,
  phone: true,
  status: true,
  created_at: true,
  updated_at: true,
};

// Same rules as owner registration (src/controllers/authController.js)
// so staff accounts get the same phone/password strength requirements.
const validatePhone = (phone) => {
  if (typeof phone !== "string") return "Phone must be a string.";
  if (!/^\d{10}$/.test(phone)) return "Phone number must be exactly 10 digits.";
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

const generateOtp = () => String(Math.floor(100000 + Math.random() * 900000)); // 6 digits

// Convert the raw UTC Date fields Prisma returns into Nepal-time ISO strings
// before they go out in an API response.
const withNPTTimestamps = (staff) => {
  if (!staff) return staff;
  return {
    ...staff,
    created_at: toNPTISOString(staff.created_at),
    updated_at: toNPTISOString(staff.updated_at),
  };
};

class StaffService {
  async create({ owner_id, full_name, email, phone, password }) {
    full_name = String(full_name || "").trim();
    email = email ? String(email).trim().toLowerCase() : null;
    phone = phone ? String(phone).trim() : null;

    if (!full_name || !password || (!email && !phone)) {
      throw {
        code: "REQUIRED_FIELDS",
        message: "full_name, password, and either email or phone are required.",
      };
    }

    if (phone) {
      const phoneError = validatePhone(phone);
      if (phoneError) {
        throw { code: "PHONE_INVALID", message: phoneError };
      }
    }

    const passwordErrors = validatePassword(password);
    if (passwordErrors.length) {
      throw {
        code: "WEAK_PASSWORD",
        message: "Password is not strong enough.",
        errors: passwordErrors,
      };
    }

    const password_hash = await hash(password, 10);

    try {
      const staff = await prisma.staff.create({
        data: { owner_id, full_name, email, phone, password: password_hash },
        select: STAFF_SELECT,
      });
      return withNPTTimestamps(staff);
    } catch (err) {
      if (err.code === "P2002") {
        const field = err.meta?.target?.[0] || "email/phone";
        throw {
          code: "DUPLICATE",
          message: `That ${field} is already in use.`,
        };
      }
      throw err;
    }
  }

  async list(owner_id) {
    const staff = await prisma.staff.findMany({
      where: { owner_id },
      select: STAFF_SELECT,
      orderBy: { created_at: "desc" },
    });
    return staff.map(withNPTTimestamps);
  }

  async getOwnProfile(owner_id, staff_id) {
    const staff = await prisma.staff.findFirst({
      where: {
        owner_id,
        staff_id,
      },
      select: {
        staff_id: true,
        owner_id: true,
        full_name: true,
        email: true,
        phone: true,
        status: true,
        created_at: true,
        updated_at: true,

        owner: {
          select: {
            business_name: true,
            business_category: true,

            package: {
              select: {
                package_key: true,
              },
            },
          },
        },
      },
    });

    if (!staff) {
      return null;
    }

    return {
      staff_id: staff.staff_id,
      owner_id: staff.owner_id,
      full_name: staff.full_name,
      email: staff.email,
      phone: staff.phone,
      status: staff.status,

      business_name: staff.owner?.business_name ?? null,
      business_category: staff.owner?.business_category ?? null,
      package_key: staff.owner?.package?.package_key ?? null,

      created_at: toNPTISOString(staff.created_at),
      updated_at: toNPTISOString(staff.updated_at),
    };
  }

  async getById(owner_id, staff_id) {
    const staff = await prisma.staff.findFirst({
      where: { owner_id, staff_id },
      select: STAFF_SELECT,
    });
    return withNPTTimestamps(staff);
  }

  async update(
    owner_id,
    staff_id,
    { full_name, email, phone, password, status },
  ) {
    const existing = await prisma.staff.findFirst({
      where: { owner_id, staff_id },
    });
    if (!existing) throw { code: "NOT_FOUND", message: "Staff not found." };

    const data = {};
    // if (full_name !== undefined) data.full_name = String(full_name).trim();\
    if (full_name !== undefined) {
      const cleanName = String(full_name).trim();

      if (!cleanName) {
        throw {
          code: "VALIDATION",
          message: "Full name is required.",
        };
      }

      data.full_name = cleanName;
    }
    if (email !== undefined)
      data.email = email ? String(email).trim().toLowerCase() : null;
    if (phone !== undefined) {
      const trimmedPhone = phone ? String(phone).trim() : null;
      if (trimmedPhone) {
        const phoneError = validatePhone(trimmedPhone);
        if (phoneError) {
          throw { code: "PHONE_INVALID", message: phoneError };
        }
      }
      data.phone = trimmedPhone;
    }

    const finalEmail = email !== undefined ? data.email : existing.email;

    const finalPhone = phone !== undefined ? data.phone : existing.phone;

    if (!finalEmail && !finalPhone) {
      throw {
        code: "VALIDATION",
        message: "Either email or phone number is required.",
      };
    }
    if (status !== undefined) {
      if (!["active", "inactive"].includes(status)) {
        throw {
          code: "VALIDATION",
          message: "status must be 'active' or 'inactive'.",
        };
      }
      data.status = status;
    }
    if (password !== undefined) {
      const passwordErrors = validatePassword(password);
      if (passwordErrors.length) {
        throw {
          code: "WEAK_PASSWORD",
          message: "Password is not strong enough.",
          errors: passwordErrors,
        };
      }
      data.password = await hash(password, 10);
    }

    try {
      const staff = await prisma.staff.update({
        where: { staff_id },
        data,
        select: STAFF_SELECT,
      });
      return withNPTTimestamps(staff);
    } catch (err) {
      if (err.code === "P2002") {
        const field = err.meta?.target?.[0] || "email/phone";
        throw {
          code: "DUPLICATE",
          message: `That ${field} is already in use.`,
        };
      }
      throw err;
    }
  }

  async remove(owner_id, staff_id) {
    const existing = await prisma.staff.findFirst({
      where: { owner_id, staff_id },
    });
    if (!existing) throw { code: "NOT_FOUND", message: "Staff not found." };

    await prisma.staff.delete({ where: { staff_id } });
    return { message: "Staff removed successfully." };
  }

  // ============ FORGOT PASSWORD (staff self-service, no login required) ============
  // Mirrors owner's OTP-based reset flow in authController.js, scoped to
  // staff_id via the staff_password_reset_otps table.

  async forgotPasswordSendOtp(email) {
    email = String(email || "")
      .trim()
      .toLowerCase();
    if (!email) {
      throw { code: "REQUIRED_FIELDS", message: "Email is required." };
    }

    const staff = await prisma.staff.findFirst({
      where: { email },
      select: { staff_id: true, email: true, status: true },
    });

    // Security best practice: don't reveal whether the email exists.
    if (!staff || !staff.email) {
      return { message: "If the email exists, an OTP has been sent." };
    }

    if (staff.status === "inactive") {
      // Still don't reveal account state to an unauthenticated caller.
      return { message: "If the email exists, an OTP has been sent." };
    }

    const activeRecord = await prisma.staffPasswordResetOtp.findFirst({
      where: { staff_id: staff.staff_id },
      orderBy: { created_at: "desc" },
    });

    const now = new Date();

    if (activeRecord?.locked_until && activeRecord.locked_until > now) {
      throw {
        code: "LOCKED",
        message:
          "Account is locked due to too many wrong OTP attempts. Try later.",
        locked_until: activeRecord.locked_until,
      };
    }

    if (activeRecord?.last_sent_at) {
      const seconds = (now - new Date(activeRecord.last_sent_at)) / 1000;
      if (seconds < 30) {
        throw {
          code: "RATE_LIMITED",
          message: "Please wait before requesting another OTP.",
        };
      }
    }

    const otp = generateOtp();
    const otpHash = await hash(otp, 10);
    const expiresAt = new Date(Date.now() + 2 * 60 * 1000); // 2 minutes

    await prisma.staffPasswordResetOtp.create({
      data: {
        staff_id: staff.staff_id,
        email: staff.email,
        otp_hash: otpHash,
        expires_at: expiresAt,
        wrong_attempts: 0,
        locked_until: null,
        last_sent_at: now,
        verified_at: null,
      },
    });

    sendOtpEmail({ to: staff.email, otp }).catch((err) =>
      console.error("Failed to send staff password reset OTP email:", err),
    );

    return { message: "If the email exists, an OTP has been sent." };
  }

  async forgotPasswordVerifyOtp(email, otp) {
    email = String(email || "")
      .trim()
      .toLowerCase();
    if (!email || !otp) {
      throw { code: "REQUIRED_FIELDS", message: "Email and OTP are required." };
    }

    const staff = await prisma.staff.findFirst({
      where: { email },
      select: { staff_id: true },
    });

    if (!staff) throw { code: "INVALID_OTP", message: "Invalid OTP." };

    const record = await prisma.staffPasswordResetOtp.findFirst({
      where: { staff_id: staff.staff_id },
      orderBy: { created_at: "desc" },
    });

    if (!record) throw { code: "INVALID_OTP", message: "Invalid OTP." };

    const now = new Date();

    if (record.locked_until && record.locked_until > now) {
      throw {
        code: "LOCKED",
        message: "Account is locked. Try later.",
        locked_until: record.locked_until,
      };
    }

    if (record.expires_at <= now) {
      throw {
        code: "OTP_EXPIRED",
        message: "OTP expired. Please request a new OTP.",
      };
    }

    const isMatch = await compare(String(otp), record.otp_hash);

    if (!isMatch) {
      const newAttempts = record.wrong_attempts + 1;

      if (newAttempts >= 3) {
        const lockedUntil = new Date(Date.now() + 5 * 60 * 60 * 1000);
        await prisma.staffPasswordResetOtp.update({
          where: { id: record.id },
          data: { wrong_attempts: newAttempts, locked_until: lockedUntil },
        });
        throw {
          code: "LOCKED",
          message: "Too many wrong OTP attempts. Account locked for 5 hours.",
          locked_until: lockedUntil,
        };
      }

      await prisma.staffPasswordResetOtp.update({
        where: { id: record.id },
        data: { wrong_attempts: newAttempts },
      });

      throw {
        code: "INVALID_OTP",
        message: "Invalid OTP.",
        remaining_attempts: 3 - newAttempts,
      };
    }

    await prisma.staffPasswordResetOtp.update({
      where: { id: record.id },
      data: { verified_at: now },
    });

    if (!process.env.JWT_SECRET) throw new Error("JWT_SECRET_MISSING");

    const resetToken = sign(
      { staff_id: staff.staff_id, purpose: "staff_reset_password" },
      process.env.JWT_SECRET,
      { expiresIn: "10m" },
    );

    return { message: "OTP verified.", reset_token: resetToken };
  }

  async forgotPasswordReset(reset_token, new_password, confirm_password) {
    if (!reset_token || !new_password || !confirm_password) {
      throw {
        code: "REQUIRED_FIELDS",
        message: "reset_token, new_password and confirm_password are required.",
      };
    }

    if (new_password !== confirm_password) {
      throw { code: "PASSWORD_MISMATCH", message: "Passwords do not match." };
    }

    const passwordErrors = validatePassword(new_password);
    if (passwordErrors.length) {
      throw {
        code: "WEAK_PASSWORD",
        message: "New password is not strong enough.",
        errors: passwordErrors,
      };
    }

    if (!process.env.JWT_SECRET) throw new Error("JWT_SECRET_MISSING");

    let decoded;
    try {
      decoded = verify(reset_token, process.env.JWT_SECRET);
    } catch {
      throw {
        code: "INVALID_TOKEN",
        message: "Invalid or expired reset token.",
      };
    }

    if (decoded.purpose !== "staff_reset_password") {
      throw { code: "INVALID_TOKEN", message: "Invalid reset token." };
    }

    const staff = await prisma.staff.findUnique({
      where: { staff_id: decoded.staff_id },
      select: { staff_id: true },
    });

    if (!staff) throw { code: "NOT_FOUND", message: "Staff not found." };

    const hashed = await hash(new_password, 10);

    await prisma.staff.update({
      where: { staff_id: decoded.staff_id },
      data: { password: hashed },
    });

    return { message: "Password reset successful. Please login." };
  }

  async verifyLogin({ identifier, password }) {
    identifier = String(identifier || "")
      .trim()
      .toLowerCase();

    const staff = await prisma.staff.findFirst({
      where: {
        OR: [{ email: identifier }, { phone: identifier }],
      },
      include: {
        owner: {
          select: {
            owner_id: true,
            business_name: true,
            business_category: true,
            package_id: true,
            status: true,
            trial_expires_at: true,
            subscription_expires_at: true,
            package: { select: { package_key: true } },
          },
        },
      },
    });

    // if (!staff) {
    //   throw { code: "INVALID_CREDENTIALS", message: "Invalid credentials." };
    // }

    // if (staff.status === "inactive") {
    //   throw {
    //     code: "STAFF_INACTIVE",
    //     message: "This staff account has been deactivated.",
    //   };
    // }

    // const isMatch = await compare(password, staff.password);
    // if (!isMatch) {
    //   throw { code: "INVALID_CREDENTIALS", message: "Invalid credentials." };
    // }

    // return staff;

    if (!staff) {
      throw {
        code: "INVALID_CREDENTIALS",
        message: "Invalid credentials.",
      };
    }

    // Check password first
    const isMatch = await compare(password, staff.password);

    if (!isMatch) {
      throw {
        code: "INVALID_CREDENTIALS",
        message: "Invalid credentials.",
      };
    }

    // Check staff status
    if (staff.status === "inactive") {
      throw {
        code: "STAFF_INACTIVE",
        message:
          "This staff account has been deactivated. Please contact the business owner.",
      };
    }

    // Check owner/business
    const owner = staff.owner;

    if (!owner) {
      throw {
        code: "BUSINESS_NOT_FOUND",
        message: "Business account not found.",
      };
    }

    if (owner.status === "inactive") {
      throw {
        code: "BUSINESS_INACTIVE",
        message:
          "This business account is currently inactive. Please contact the account owner.",
      };
    }

    const now = new Date();

    // Check trial expiry
    if (
      owner.status === "trial" &&
      owner.trial_expires_at &&
      now > new Date(owner.trial_expires_at)
    ) {
      throw {
        code: "TRIAL_EXPIRED",
        message:
          "The business trial has expired. Please contact the account owner.",
      };
    }

    // Check subscription expiry
    if (
      owner.status === "active" &&
      owner.subscription_expires_at &&
      now > new Date(owner.subscription_expires_at)
    ) {
      throw {
        code: "SUBSCRIPTION_EXPIRED",
        message:
          "The business subscription has expired. Please contact the account owner.",
      };
    }

    return staff;
  }
}

export default new StaffService();
