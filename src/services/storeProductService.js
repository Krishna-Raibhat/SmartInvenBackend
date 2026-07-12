// src/services/storeProductService.js
import { prisma } from "../prisma/client.js";

class StoreProductService {
  async create({
    owner_id,
    category_id,
    unit_id,
    product_name,
    type = "item",
    description,
    cp,
    sp,
  }) {
    product_name = String(product_name).trim();

    if (type === "item" && !unit_id) {
      throw {
        code: "REQUIRED_FIELDS",
        message: "unit_id is required for item.",
      };
    }

    if (type === "service" && !sp) {
      throw { code: "REQUIRED_FIELDS", message: "sp is required for service." };
    }

    try {
      return await prisma.storeProduct.create({
        data: {
          owner_id,
          category_id: category_id || null,
          unit_id: unit_id || null,
          product_name,
          type,
          description: description?.trim() || null,
          cp: cp ?? null,
          sp: sp ?? null,
        },
        include: {
          category: true,
          unit: true,
        },
      });
    } catch (err) {
      if (err.code === "P2002") {
        throw { code: "DUPLICATE", message: "Product name already exists." };
      }
      if (err.code === "P2003") {
        if (unit_id) {
          const unit = await prisma.storeUnit.findFirst({
            where: { unit_id, owner_id },
          });
          if (!unit) {
            throw { code: "UNIT_NOT_FOUND", message: "Unit not found." };
          }
        }
        if (category_id) {
          const category = await prisma.storeCategory.findFirst({
            where: { category_id, owner_id },
          });
          if (!category) {
            throw { code: "CATEGORY_NOT_FOUND", message: "Category not found." };
          }
        }
      }
      throw err;
    }
  }

  async list(owner_id) {
    try {
      const rows = await prisma.$queryRaw`
        SELECT 
          p.product_id,
          p.product_name,
          p.type::text AS type,
          p.description,
          p.cp::numeric,
          p.sp::numeric,
          p.created_at,
          p.updated_at,
          p.category_id,
          p.unit_id,
          CASE WHEN p.category_id IS NOT NULL THEN json_build_object(
            'category_id', c.category_id,
            'category_name', c.category_name,
            'created_at', c.created_at,
            'updated_at', c.updated_at
          ) ELSE NULL END AS category,
          CASE WHEN p.unit_id IS NOT NULL THEN json_build_object(
            'unit_id', u.unit_id,
            'unit_name', u.unit_name,
            'created_at', u.created_at,
            'updated_at', u.updated_at
          ) ELSE NULL END AS unit,
          COALESCE(sl.stock_lots, '[]'::json) AS stock_lots,
          COALESCE(sl.stock, 0)::int AS stock
        FROM store_products p
        LEFT JOIN store_categories c ON c.category_id = p.category_id
        LEFT JOIN store_units u ON u.unit_id = p.unit_id
        LEFT JOIN (
          SELECT 
            product_id,
            json_agg(json_build_object('product_id', product_id, 'qty_remaining', qty_remaining)) AS stock_lots,
            SUM(qty_remaining) AS stock
          FROM store_stock_lots
          WHERE owner_id = ${owner_id} AND qty_remaining > 0
          GROUP BY product_id
        ) sl ON p.product_id = sl.product_id
        WHERE p.owner_id = ${owner_id}
        ORDER BY p.created_at DESC
      `;

      return rows.map((p) => {
        const stock = Number(p.stock || 0);
        let stock_status = "in_stock";

        if (stock <= 0) {
          stock_status = "out_of_stock";
        } else if (stock <= 10) {
          stock_status = "low_stock";
        }

        return {
          product_id: p.product_id,
          owner_id,
          category_id: p.category_id,
          unit_id: p.unit_id,
          product_name: p.product_name,
          description: p.description,
          created_at: p.created_at,
          updated_at: p.updated_at,
          cp: p.cp ? Number(p.cp) : null,
          sp: p.sp ? Number(p.sp) : null,
          type: p.type,
          category: p.category,
          unit: p.unit,
          stockLots: p.stock_lots || [],
          stock,
          stock_status,
        };
      });
    } catch (err) {
      console.error("Error in optimized storeProductService.list:", err);
      throw err;
    }
  }

  async getById(owner_id, product_id) {
    try {
      const rows = await prisma.$queryRaw`
        SELECT
          p.product_id,
          p.owner_id,
          p.category_id,
          p.unit_id,
          p.product_name,
          p.description,
          p.cp::numeric,
          p.sp::numeric,
          p.type::text AS type,
          p.created_at,
          p.updated_at,
          CASE WHEN p.category_id IS NOT NULL THEN json_build_object(
            'category_id', c.category_id,
            'category_name', c.category_name,
            'created_at', c.created_at,
            'updated_at', c.updated_at
          ) ELSE NULL END AS category,
          CASE WHEN p.unit_id IS NOT NULL THEN json_build_object(
            'unit_id', u.unit_id,
            'unit_name', u.unit_name,
            'created_at', u.created_at,
            'updated_at', u.updated_at
          ) ELSE NULL END AS unit,
          COALESCE(
            (
              SELECT json_agg(
                json_build_object(
                  'lot_id', sl.lot_id,
                  'qty_in', sl.qty_in,
                  'qty_remaining', sl.qty_remaining,
                  'cp', sl.cp::numeric,
                  'sp', sl.sp::numeric,
                  'notes', sl.notes,
                  'created_at', sl.created_at,
                  'updated_at', sl.updated_at,
                  'supplier', CASE WHEN sl.supplier_id IS NOT NULL THEN json_build_object(
                    'supplier_id', sup.supplier_id,
                    'supplier_name', sup.supplier_name,
                    'phone', sup.phone,
                    'email', sup.email,
                    'address', sup.address
                  ) ELSE NULL END
                ) ORDER BY sl.created_at DESC
              )
              FROM store_stock_lots sl
              LEFT JOIN store_suppliers sup ON sup.supplier_id = sl.supplier_id
              WHERE sl.product_id = p.product_id
            ),
            '[]'::json
          ) AS stock_lots
        FROM store_products p
        LEFT JOIN store_categories c ON c.category_id = p.category_id
        LEFT JOIN store_units u ON u.unit_id = p.unit_id
        WHERE p.product_id = ${product_id} AND p.owner_id = ${owner_id}
        LIMIT 1
      `;

      const p = rows[0];
      if (!p) throw { code: "NOT_FOUND", message: "Product not found." };

      return {
        product_id: p.product_id,
        owner_id: p.owner_id,
        category_id: p.category_id,
        unit_id: p.unit_id,
        product_name: p.product_name,
        description: p.description,
        cp: p.cp ? Number(p.cp) : null,
        sp: p.sp ? Number(p.sp) : null,
        type: p.type,
        created_at: p.created_at,
        updated_at: p.updated_at,
        category: p.category,
        unit: p.unit,
        stockLots: (p.stock_lots || []).map((lot) => ({
          lot_id: lot.lot_id,
          qty_in: Number(lot.qty_in || 0),
          qty_remaining: Number(lot.qty_remaining || 0),
          cp: lot.cp ? Number(lot.cp) : 0,
          sp: lot.sp ? Number(lot.sp) : 0,
          notes: lot.notes,
          created_at: lot.created_at,
          updated_at: lot.updated_at,
          supplier: lot.supplier,
        })),
      };
    } catch (err) {
      console.error("Error in optimized storeProductService.getById:", err);
      throw err;
    }
  }

  async update(
    owner_id,
    product_id,
    { category_id, unit_id, product_name, type, description, cp, sp },
  ) {
    const existing = await prisma.storeProduct.findFirst({
      where: { owner_id, product_id },
    });

    if (!existing) throw { code: "NOT_FOUND", message: "Product not found." };

    const resolvedType = type ?? existing.type;

    if (resolvedType === "item") {
      const resolvedUnit = unit_id ?? existing.unit_id;
      if (!resolvedUnit)
        throw {
          code: "REQUIRED_FIELDS",
          message: "unit_id is required for item.",
        };
    }

    if (resolvedType === "service") {
      const resolvedSp = sp ?? existing.sp;
      if (!resolvedSp)
        throw {
          code: "REQUIRED_FIELDS",
          message: "sp is required for service.",
        };
    }

    const data = {};
    if (product_name !== undefined)
      data.product_name = String(product_name).trim();
    if (type !== undefined) data.type = type;
    if (description !== undefined)
      data.description = description?.trim() || null;
    if (category_id !== undefined) data.category_id = category_id || null;
    if (unit_id !== undefined) data.unit_id = unit_id || null;
    if (cp !== undefined) data.cp = cp ?? null;
    if (sp !== undefined) data.sp = sp ?? null;

    try {
      return await prisma.storeProduct.update({
        where: { product_id },
        data,
        include: { category: true, unit: true },
      });
    } catch (err) {
      if (err.code === "P2002") {
        throw { code: "DUPLICATE", message: "Product name already exists." };
      }
      if (err.code === "P2003") {
        if (unit_id) {
          const unit = await prisma.storeUnit.findFirst({
            where: { unit_id, owner_id },
          });
          if (!unit) {
            throw { code: "UNIT_NOT_FOUND", message: "Unit not found." };
          }
        }
        if (category_id) {
          const category = await prisma.storeCategory.findFirst({
            where: { category_id, owner_id },
          });
          if (!category) {
            throw { code: "CATEGORY_NOT_FOUND", message: "Category not found." };
          }
        }
      }
      throw err;
    }
  }

  async delete(owner_id, product_id) {
    const existing = await prisma.storeProduct.findFirst({
      where: { owner_id, product_id },
    });

    if (!existing) throw { code: "NOT_FOUND", message: "Product not found." };

    const linkedLots = await prisma.storeStockLot.count({
      where: { product_id },
    });

    if (linkedLots > 0) {
      throw {
        code: "IN_USE",
        message: `Cannot delete "${existing.product_name}". It has ${linkedLots} stock lot(s) linked.`,
        details: { stock_lots: linkedLots },
      };
    }

    await prisma.storeProduct.delete({ where: { product_id } });
    return { message: "Product deleted successfully." };
  }
}

export default new StoreProductService();
