const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const Owner = require("../models/Owner");

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

// POST /api/auth/register
exports.register = async (req, res) => {
  try {
    const { full_name, phone, email, password } = req.body;

    // Basic validation
    if (!full_name || !phone || !email || !password) {
      return res.status(400).json({
        message: "full_name, phone, email and password are required.",
      });
    }

    // Check existing owner by email
    const existingEmail = await Owner.findOne({ where: { email } });
    if (existingEmail) {
      return res
        .status(409)
        .json({ message: "Owner with this email already exists." });
    }

    // Check existing owner by phone
    const existingPhone = await Owner.findOne({ where: { phone } });
    if (existingPhone) {
      return res
        .status(409)
        .json({ message: "Owner with this phone already exists." });
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

    // Generate token
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
    return res
      .status(500)
      .json({ message: "Server error during registration" });
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
