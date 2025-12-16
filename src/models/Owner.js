const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");
const Package = require("./Package"); // import Package for FK association

const Owner = sequelize.define(
  "Owner",
  {
    owner_id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      field: "owner_id",
    },
    full_name: {
      type: DataTypes.STRING,
      allowNull: false,
      field: "full_name",
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      field: "email",
      validate: { isEmail: true },
    },
    phone: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      field: "phone",
    },
    password: {
      type: DataTypes.STRING,
      allowNull: false,
      field: "password_hash",
    },
    fcm_token: {
      type: DataTypes.STRING,
      allowNull: true,
      field: "fcm_token",
    },

    package_id:{
      type: DataTypes.UUID,
      allowNull: true,
      field: "package_id",
      references: {
        model: "packages",
        key: "package_id",
      },
      onDelete: "RESTRICT",
    },
  },
  {
    tableName: "owners",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
  }
);


// Associations
Package.hasMany(Owner, {foreignKey: "package_id", as: "owners"});
Owner.belongsTo(Package, { foreignKey: "package_id", as: "package" });

module.exports = Owner;
