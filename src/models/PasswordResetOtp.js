const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");
const Owner = require("./Owner");

const PasswordResetOtp = sequelize.define(
  "PasswordResetOtp",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      field: "id",
    },
    owner_id: {
      type: DataTypes.UUID,
      allowNull: false,
      field: "owner_id",
      references: { model: Owner, key: "owner_id" },
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      field: "email",
    },
    otp_hash: {
      type: DataTypes.STRING,
      allowNull: false,
      field: "otp_hash",
    },
    expires_at: {
      type: DataTypes.DATE,
      allowNull: false,
      field: "expires_at",
    },
    wrong_attempts: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      field: "wrong_attempts",
    },
    locked_until: {
      type: DataTypes.DATE,
      allowNull: true,
      field: "locked_until",
    },
    last_sent_at: {
      type: DataTypes.DATE,
      allowNull: true,
      field: "last_sent_at",
    },
    verified_at: {
      type: DataTypes.DATE,
      allowNull: true,
      field: "verified_at",
    },
  },
  {
    tableName: "password_reset_otps",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    indexes: [
      { fields: ["owner_id"] },
      { fields: ["email"] },
      { fields: ["expires_at"] },
    ],
  }
);

Owner.hasMany(PasswordResetOtp, { foreignKey: "owner_id" });
PasswordResetOtp.belongsTo(Owner, { foreignKey: "owner_id" });

module.exports = PasswordResetOtp;
