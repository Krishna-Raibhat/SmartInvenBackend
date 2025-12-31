const {prisma}  = require("../prisma/client");

class HardwareProductService {
  async createProductMaster({ owner_id,  product_name, category_id }) {
    const name = String(product_name || "").trim();
    if (!name) {
      const err = new Error("product_name is required");
      err.status = 400;
      err.code = "VALIDATION_REQUIRED_FIELDS";
      throw err;
    }

    if (!category_id) {
      const err = new Error("category_id is required");
      err.status = 400;
      err.code = "VALIDATION_REQUIRED_FIELDS";
      throw err;
    }
 // 1) load owner.package_id
    const owner = await prisma.owner.findUnique({
      where: { owner_id },
      select: { package_id: true },
    });

    if (!owner?.package_id) {
      const err = new Error("Owner has no package_id");
      err.status = 400;
      err.code = "NO_PACKAGE";
      throw err;
    }

    // ✅ Ensure category exists
    const category = await prisma.hardwareCategory.findUnique({
      where: { category_id },
      select: { category_id: true, package_id: true },
    });

    if (!category) {
      const err = new Error("Category not found");
      err.status = 404;
      err.code = "CATEGORY_NOT_FOUND";
      throw err;
    }
// 3) enforce same package
    if (category.package_id !== owner.package_id) {
      const err = new Error("Category does not belong to your package");
      err.status = 403;
      err.code = "CATEGORY_PACKAGE_MISMATCH";
      throw err;
    }
    // ✅ Enforce owner-based uniqueness
    try {
      return await prisma.hardwareProduct.create({
        data: {
          owner_id,
          product_name: name,
          category_id
        },
      });
    } catch (e) {
      if (e.code === "P2002") {
        const err = new Error("Product already exists for this owner.");
        err.status = 409;
        err.code = "PRODUCT_ALREADY_EXISTS";
        throw err;
      }
      throw e;
    }
    
  }

  async listProducts(owner_id) {
    return prisma.hardwareProduct.findMany({
      where: { owner_id },
      orderBy: { product_name: "asc" },
      include: {
        category: { select: { category_id: true, category_name: true } },
      },
    });
  }

  async getById(owner_id, product_id) {
    return prisma.hardwareProduct.findFirst({
      where: { owner_id, product_id },
      include: {
        category: { select: { category_id: true, category_name: true } },
      },
    });
  }

  async updateProduct(owner_id, product_id, data) {
  const product = await prisma.hardwareProduct.findFirst({
    where: { owner_id, product_id },
    select: { product_id: true },
  });
  if (!product) return null;

  const updateData = {};

  if (data.product_name !== undefined) {
    const n = String(data.product_name || "").trim();
    if (!n) {
      const err = new Error("product_name cannot be empty");
      err.status = 400;
      err.code = "VALIDATION_REQUIRED_FIELDS";
      throw err;
    }
    updateData.product_name = n;
  }

  if (data.category_id !== undefined) {
    const owner = await prisma.owner.findUnique({
      where: { owner_id },
      select: { package_id: true },
    });
    if (!owner?.package_id) {
      const err = new Error("Owner has no package_id");
      err.status = 400;
      err.code = "NO_PACKAGE";
      throw err;
    }

    const category = await prisma.hardwareCategory.findUnique({
      where: { category_id: data.category_id },
      select: { package_id: true },
    });
    if (!category) {
      const err = new Error("Category not found");
      err.status = 404;
      err.code = "CATEGORY_NOT_FOUND";
      throw err;
    }

    if (category.package_id !== owner.package_id) {
      const err = new Error("Category does not belong to your package");
      err.status = 403;
      err.code = "CATEGORY_PACKAGE_MISMATCH";
      throw err;
    }

    updateData.category_id = data.category_id;
  }

  try {
    return await prisma.hardwareProduct.update({
      where: { product_id },
      data: updateData,
    });
  } catch (e) {
    if (e.code === "P2002") {
      const err = new Error("Product already exists for this owner.");
      err.status = 409;
      err.code = "PRODUCT_ALREADY_EXISTS";
      throw err;
    }
    throw e;
  }
}
}

module.exports = new HardwareProductService();
