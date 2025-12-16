const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const Package = sequelize.define(
  "Package",
  {
    package_id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      field: "package_id",
    },

    package_key: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      field: "package_key",
      comment: "Unique key like hardware, clothing, grocery",
    },

    package_name: {
      type: DataTypes.STRING,
      allowNull: false,
      field: "package_name",
      comment: "Human-readable name like Hardware Store, Clothing Store",
    },
  },

  {
    tableName: "packages",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: false,
  }
);

module.exports = Package;