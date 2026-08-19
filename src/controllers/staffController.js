// src/controllers/staffController.js
import jwt from "jsonwebtoken";
import staffService from "../services/staffService.js";

const { sign } = jwt;

const generateStaffToken = (staff) => {
  if (!process.env.JWT_SECRET) throw new Error("JWT_SECRET_MISSING");

  return sign(
    {
      owner_id: staff.owner_id,
      staff_id: staff.staff_id,
      email: staff.email,
      package_id: staff.owner?.package_id ?? null,
      package_key: staff.owner?.package?.package_key ?? null,
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || "7d" },
  );
};

const staffController = {
  // Owner creates a staff account for their own business
  async create(req, res) {
    try {
      const owner_id = req.owner.owner_id;
      const { full_name, email, phone, password } = req.body;

      const staff = await staffService.create({
        owner_id,
        full_name,
        email,
        phone,
        password,
      });

      return res.status(201).json({ success: true, data: staff });
    } catch (error) {
      if (
        ["REQUIRED_FIELDS", "WEAK_PASSWORD", "PHONE_INVALID"].includes(
          error.code,
        )
      ) {
        return res.status(400).json({
          success: false,
          error_code: error.code,
          message: error.message,
          ...(error.errors ? { errors: error.errors } : {}),
        });
      }
      if (error.code === "DUPLICATE") {
        return res.status(409).json({
          success: false,
          error_code: error.code,
          message: error.message,
        });
      }
      console.error("Error creating staff:", error);
      return res.status(500).json({
        success: false,
        error_code: "SERVER_ERROR",
        message: "Failed to create staff.",
      });
    }
  },

  async list(req, res) {
    try {
      const owner_id = req.owner.owner_id;
      const staff = await staffService.list(owner_id);
      return res.status(200).json({ success: true, data: staff });
    } catch (error) {
      console.error("Error listing staff:", error);
      return res.status(500).json({
        success: false,
        error_code: "SERVER_ERROR",
        message: "Failed to fetch staff.",
      });
    }
  },

  async getById(req, res) {
    try {
      const owner_id = req.owner.owner_id;
      const { id } = req.params;

      const staff = await staffService.getById(owner_id, id);
      if (!staff) {
        return res.status(404).json({
          success: false,
          error_code: "NOT_FOUND",
          message: "Staff not found.",
        });
      }

      return res.status(200).json({ success: true, data: staff });
    } catch (error) {
      console.error("Error fetching staff:", error);
      return res.status(500).json({
        success: false,
        error_code: "SERVER_ERROR",
        message: "Failed to fetch staff.",
      });
    }
  },

  async update(req, res) {
    try {
      const owner_id = req.owner.owner_id;
      const { id } = req.params;
      const { full_name, email, phone, password, status } = req.body;

      const staff = await staffService.update(owner_id, id, {
        full_name,
        email,
        phone,
        password,
        status,
      });

      return res.status(200).json({ success: true, data: staff });
    } catch (error) {
      if (error.code === "NOT_FOUND") {
        return res.status(404).json({
          success: false,
          error_code: error.code,
          message: error.message,
        });
      }
      if (["DUPLICATE"].includes(error.code)) {
        return res.status(409).json({
          success: false,
          error_code: error.code,
          message: error.message,
        });
      }
      if (
        ["WEAK_PASSWORD", "VALIDATION", "PHONE_INVALID"].includes(error.code)
      ) {
        return res.status(400).json({
          success: false,
          error_code: error.code,
          message: error.message,
          ...(error.errors ? { errors: error.errors } : {}),
        });
      }
      console.error("Error updating staff:", error);
      return res.status(500).json({
        success: false,
        error_code: "SERVER_ERROR",
        message: "Failed to update staff.",
      });
    }
  },

  // Staff views their own profile
  async me(req, res) {
    try {
      const owner_id = req.owner.owner_id;
      const staff_id = req.staff.staff_id;

      const staff = await staffService.getOwnProfile(owner_id, staff_id);
      if (!staff) {
        return res.status(404).json({
          success: false,
          error_code: "NOT_FOUND",
          message: "Staff not found.",
        });
      }

      return res.status(200).json({ success: true, data: staff });
    } catch (error) {
      console.error("Error fetching own staff profile:", error);
      return res.status(500).json({
        success: false,
        error_code: "SERVER_ERROR",
        message: "Failed to fetch profile.",
      });
    }
  },

  // Staff updates their own name/password only — no email, phone, or status changes
  async updateMe(req, res) {
    try {
      const owner_id = req.owner.owner_id;
      const staff_id = req.staff.staff_id;
      const { full_name, password } = req.body;

      const staff = await staffService.update(owner_id, staff_id, {
        full_name,
        password,
      });

      return res.status(200).json({ success: true, data: staff });
    } catch (error) {
      if (error.code === "NOT_FOUND") {
        return res.status(404).json({
          success: false,
          error_code: error.code,
          message: error.message,
        });
      }
      if (["WEAK_PASSWORD", "VALIDATION"].includes(error.code)) {
        return res.status(400).json({
          success: false,
          error_code: error.code,
          message: error.message,
          ...(error.errors ? { errors: error.errors } : {}),
        });
      }
      console.error("Error updating own staff profile:", error);
      return res.status(500).json({
        success: false,
        error_code: "SERVER_ERROR",
        message: "Failed to update profile.",
      });
    }
  },

  async remove(req, res) {
    try {
      const owner_id = req.owner.owner_id;
      const { id } = req.params;

      const result = await staffService.remove(owner_id, id);
      return res.status(200).json({ success: true, message: result.message });
    } catch (error) {
      if (error.code === "NOT_FOUND") {
        return res.status(404).json({
          success: false,
          error_code: error.code,
          message: error.message,
        });
      }
      console.error("Error removing staff:", error);
      return res.status(500).json({
        success: false,
        error_code: "SERVER_ERROR",
        message: "Failed to remove staff.",
      });
    }
  },

  // Staff forgot their password — send an OTP to their email on file
  async forgotPasswordSendOtp(req, res) {
    try {
      const { email } = req.body;
      const result = await staffService.forgotPasswordSendOtp(email);
      return res.status(200).json({ success: true, ...result });
    } catch (error) {
      if (error.code === "LOCKED") {
        return res.status(423).json({
          success: false,
          error_code: error.code,
          message: error.message,
          locked_until: error.locked_until,
        });
      }
      if (error.code === "RATE_LIMITED") {
        return res
          .status(429)
          .json({
            success: false,
            error_code: error.code,
            message: error.message,
          });
      }
      if (error.code === "REQUIRED_FIELDS") {
        return res
          .status(400)
          .json({
            success: false,
            error_code: error.code,
            message: error.message,
          });
      }
      console.error("Error sending staff forgot-password OTP:", error);
      return res
        .status(500)
        .json({
          success: false,
          error_code: "SERVER_ERROR",
          message: "Server error.",
        });
    }
  },

  async forgotPasswordVerifyOtp(req, res) {
    try {
      const { email, otp } = req.body;
      const result = await staffService.forgotPasswordVerifyOtp(email, otp);
      return res.status(200).json({ success: true, ...result });
    } catch (error) {
      if (error.code === "LOCKED") {
        return res.status(423).json({
          success: false,
          error_code: error.code,
          message: error.message,
          locked_until: error.locked_until,
        });
      }
      if (error.code === "OTP_EXPIRED") {
        return res
          .status(400)
          .json({
            success: false,
            error_code: error.code,
            message: error.message,
          });
      }
      if (error.code === "INVALID_OTP") {
        return res.status(401).json({
          success: false,
          error_code: error.code,
          message: error.message,
          ...(error.remaining_attempts !== undefined
            ? { remaining_attempts: error.remaining_attempts }
            : {}),
        });
      }
      if (error.code === "REQUIRED_FIELDS") {
        return res
          .status(400)
          .json({
            success: false,
            error_code: error.code,
            message: error.message,
          });
      }
      console.error("Error verifying staff forgot-password OTP:", error);
      return res
        .status(500)
        .json({
          success: false,
          error_code: "SERVER_ERROR",
          message: "Server error.",
        });
    }
  },

  async forgotPasswordReset(req, res) {
    try {
      const { reset_token, new_password, confirm_password } = req.body;
      const result = await staffService.forgotPasswordReset(
        reset_token,
        new_password,
        confirm_password,
      );
      return res.status(200).json({ success: true, ...result });
    } catch (error) {
      if (
        ["REQUIRED_FIELDS", "PASSWORD_MISMATCH", "WEAK_PASSWORD"].includes(
          error.code,
        )
      ) {
        return res.status(400).json({
          success: false,
          error_code: error.code,
          message: error.message,
          ...(error.errors ? { errors: error.errors } : {}),
        });
      }
      if (error.code === "INVALID_TOKEN") {
        return res
          .status(401)
          .json({
            success: false,
            error_code: error.code,
            message: error.message,
          });
      }
      if (error.code === "NOT_FOUND") {
        return res
          .status(404)
          .json({
            success: false,
            error_code: error.code,
            message: error.message,
          });
      }
      console.error("Error resetting staff password:", error);
      return res
        .status(500)
        .json({
          success: false,
          error_code: "SERVER_ERROR",
          message: "Server error.",
        });
    }
  },

  // Staff logs in with email/phone + password, gets a token scoped to the owner's business
  async login(req, res) {
    try {
      const { email, phone, password } = req.body;
      const identifier = email || phone;

      if (!identifier || !password) {
        return res.status(400).json({
          success: false,
          error_code: "REQUIRED_FIELDS",
          message: "Email or phone, and password, are required.",
        });
      }

      const staff = await staffService.verifyLogin({ identifier, password });

      if (staff.owner.status === "inactive") {
        return res.status(403).json({
          success: false,
          error_code: "OWNER_ACCOUNT_INACTIVE",
          message:
            "This business account is inactive. Please contact the owner.",
        });
      }

      const token = generateStaffToken(staff);

      return res.status(200).json({
        success: true,
        message: "Login successful.",
        token,
        staff: {
          staff_id: staff.staff_id,
          owner_id: staff.owner_id,
          full_name: staff.full_name,
          email: staff.email,
          phone: staff.phone,
          status: staff.status,
          business_name: staff.owner?.business_name ?? null,
          business_category: staff.owner?.business_category ?? null,
          package_key: staff.owner?.package?.package_key ?? null,
        },
      });
    } catch (error) {
      if (["INVALID_CREDENTIALS", "STAFF_INACTIVE"].includes(error.code)) {
        return res.status(401).json({
          success: false,
          error_code: error.code,
          message: error.message,
        });
      }
      console.error("Error during staff login:", error);
      return res.status(500).json({
        success: false,
        error_code: "SERVER_ERROR",
        message: "Login failed.",
      });
    }
  },
};

export default staffController;
