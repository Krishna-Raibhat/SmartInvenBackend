import prisma from '../prisma/client.js';

class GroceryUnitService {
  /**
   * Create a new grocery unit
   */
  async createUnit(ownerId, unitName) {
    const normalizedName = unitName.toLowerCase().trim();

    // Check if unit already exists for this owner
    const existing = await prisma.groceryUnit.findUnique({
      where: {
        owner_id_unit_name: {
          owner_id: ownerId,
          unit_name: normalizedName,
        },
      },
    });

    if (existing) {
      throw new Error('Unit already exists');
    }

    return await prisma.groceryUnit.create({
      data: {
        owner_id: ownerId,
        unit_name: normalizedName,
      },
    });
  }

  /**
   * Get all units for an owner
   */
  async getUnitsByOwner(ownerId) {
    return await prisma.groceryUnit.findMany({
      where: { owner_id: ownerId },
      orderBy: { unit_name: 'asc' },
    });
  }

  /**
   * Get a single unit by ID
   */
  async getUnitById(unitId, ownerId) {
    const unit = await prisma.groceryUnit.findUnique({
      where: { unit_id: unitId },
    });

    if (!unit) {
      throw new Error('Unit not found');
    }

    if (unit.owner_id !== ownerId) {
      throw new Error('Unauthorized access to this unit');
    }

    return unit;
  }

  /**
   * Update a unit
   */
  async updateUnit(unitId, ownerId, unitName) {
    const normalizedName = unitName.toLowerCase().trim();

    // Check if unit exists and belongs to owner
    const unit = await this.getUnitById(unitId, ownerId);

    // Check if new name conflicts with existing unit
    const existing = await prisma.groceryUnit.findUnique({
      where: {
        owner_id_unit_name: {
          owner_id: ownerId,
          unit_name: normalizedName,
        },
      },
    });

    if (existing && existing.unit_id !== unitId) {
      throw new Error('Unit name already exists');
    }

    return await prisma.groceryUnit.update({
      where: { unit_id: unitId },
      data: { unit_name: normalizedName },
    });
  }

  /**
   * Delete a unit
   */
  async deleteUnit(unitId, ownerId) {
    // Check if unit exists and belongs to owner
    await this.getUnitById(unitId, ownerId);

    // Check if unit is being used by any products
    const productsCount = await prisma.groceryProduct.count({
      where: { unit_id: unitId },
    });

    if (productsCount > 0) {
      throw new Error(
        `Cannot delete unit. It is being used by ${productsCount} product(s)`
      );
    }

    await prisma.groceryUnit.delete({
      where: { unit_id: unitId },
    });

    return { message: 'Unit deleted successfully' };
  }
}

export default new GroceryUnitService();
