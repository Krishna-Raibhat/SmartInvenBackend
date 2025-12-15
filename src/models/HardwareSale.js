const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const HardwareSale = sequelize.define(
  "HardwareSale",
  {
    sales_id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      field: "sales_id",
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

    supplier_id: {
      type: DataTypes.UUID,
      allowNull: false,
      field: "supplier_id",
      references: {
        model: "hardware_suppliers",
        key: "supplier_id",
      },
      onDelete: "CASCADE",
    },

    product_id: {
      type: DataTypes.UUID,
      allowNull: false,
      field: "product_id",
      references: {
        model: "hardware_products",
        key: "product_id",
      },
      onDelete: "CASCADE",
    },

    purchase_date: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      field: "purchase_date",
    },

    sale_date: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      field: "sale_date",
    },

    sales_qty: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: "sales_qty",
    },

    total_amount: {
      type: DataTypes.FLOAT,
      allowNull: false,
      field: "total_amount",
    },
    
    payment_status: {
      type: DataTypes.ENUM("pending", "paid", "partial"),
      defaultValue: "pending",
      allowNull: false,
      field: "payment_status",
    },

    note: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: "note",
    },
  },

  {
    tableName: "hardware_sales",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: false,
  }
);

// Associations

// Owner ↔ HardwareSale
Owner.hasMany(HardwareSale, { foreignKey: "owner_id", as: "sales" });
HardwareSale.belongsTo(Owner, { foreignKey: "owner_id", as: "owner" });

// Supplier ↔ HardwareSale
HardwareSupplier.hasMany(HardwareSale, { foreignKey: "supplier_id", as: "sales" });
HardwareSale.belongsTo(HardwareSupplier, { foreignKey: "supplier_id", as: "supplier" });

// Product ↔ HardwareSale
HardwareProduct.hasMany(HardwareSale, { foreignKey: "product_id", as: "sales" });
HardwareSale.belongsTo(HardwareProduct, { foreignKey: "product_id", as: "product" });

module.exports = HardwareSale;