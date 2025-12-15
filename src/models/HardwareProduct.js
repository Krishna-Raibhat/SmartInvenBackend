const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const HardwareProduct = sequelize.define(
  "HardwareProduct",
  {
    product_id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      field: "product_id",
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

    product_name: {
      type: DataTypes.STRING,
      allowNull: false,
      field: "product_name",
    },

    type: {
      type: DataTypes.STRING,
      allowNull: false,
      field: "type",
    },

    unit: {
      type: DataTypes.STRING,
      allowNull: false,
      field: "unit",
    },
  },

  {
    tableName: "hardware_products",
    timestamps : true,
    createdAt: "created_at",
    updatedAt: false,
  }
);

module.exports = HardwareProduct;