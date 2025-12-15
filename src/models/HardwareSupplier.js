const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");
const Owner = require("./Owner");

const HardwareSupplier = sequelize.define(
  "HardwareSupplier",
  {
    supplier_id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      field: "supplier_id",
    },

    owner_id: {
      type: DataTypes.UUID,
      allowNull: false,
      field: "owner_id",
      references: {
        model: "owners",
        key: "owner_id",
      },
      onDelete: "CASCADE",
    },

    supplier_name: {
      type: DataTypes.STRING,
      allowNull: false,
      field: "supplier_name",
    },

    phone: {
      type: DataTypes.STRING,
      allowNull: false,
      field: "phone",
    },

    email: {
      type: DataTypes.STRING,
      allowNull: true,
      field: "email",
      validate: {
        isEmail: true,
      },
    },

    address: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: "address",
    },
  },

  {
    tableName: "hardware_suppliers",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: false, // only created_at exists
  }
);

//Associations
Owner.hasMany(HardwareSupplier, { foreignKey: "owner_id" });
HardwareSupplier.belongsTo(Owner, { foreignKey: "owner_id" });

module.exports = HardwareSupplier;
