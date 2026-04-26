import { prisma } from "../prisma/client.js";

class PackageService {
  // Normalize package_key: lowercase and trim
  normalizePackageKey(key) {
    return key.trim().toLowerCase();
  }

  async getAllPackages() {
    return await prisma.package.findMany({
      orderBy: { created_at: "asc" },
      select: {
        package_id: true,
        package_key: true,
        package_name: true,
        created_at: true,
        _count: { select: { owners: true } },
      },
    });
  }

  async getPackageById(packageId) {
    const pkg = await prisma.package.findUnique({
      where: { package_id: packageId },
      select: {
        package_id: true,
        package_key: true,
        package_name: true,
        created_at: true,
        _count: { select: { owners: true } },
      },
    });

    if (!pkg) {
      const error = new Error("Package not found.");
      error.code = "NOT_FOUND";
      error.statusCode = 404;
      throw error;
    }

    return pkg;
  }

  async createPackage(data) {
    let { package_key, package_name } = data;

    if (!package_key || !package_name) {
      const error = new Error("package_key and package_name are required.");
      error.code = "REQUIRED_FIELDS";
      error.statusCode = 400;
      throw error;
    }

    // Normalize package_key
    package_key = this.normalizePackageKey(package_key);
    package_name = package_name.trim();

    // Check if normalized package_key already exists
    const allPackages = await prisma.package.findMany({
      select: { package_key: true },
    });

    const duplicate = allPackages.find(
      (pkg) => this.normalizePackageKey(pkg.package_key) === package_key
    );

    if (duplicate) {
      const error = new Error(
        `Package key already exists as "${duplicate.package_key}". Package keys are case-insensitive.`
      );
      error.code = "DUPLICATE_KEY";
      error.statusCode = 409;
      throw error;
    }

    return await prisma.package.create({
      data: { package_key, package_name },
      select: {
        package_id: true,
        package_key: true,
        package_name: true,
        created_at: true,
      },
    });
  }

  async updatePackage(packageId, data) {
    let { package_key, package_name } = data;

    if (!package_key && !package_name) {
      const error = new Error("At least one field is required.");
      error.code = "NO_FIELDS";
      error.statusCode = 400;
      throw error;
    }

    const existing = await prisma.package.findUnique({
      where: { package_id: packageId },
    });

    if (!existing) {
      const error = new Error("Package not found.");
      error.code = "NOT_FOUND";
      error.statusCode = 404;
      throw error;
    }

    // Normalize if package_key is being updated
    if (package_key) {
      package_key = this.normalizePackageKey(package_key);

      // Check if new normalized package_key conflicts with another package
      if (package_key !== this.normalizePackageKey(existing.package_key)) {
        const allPackages = await prisma.package.findMany({
          where: { NOT: { package_id: packageId } },
          select: { package_key: true },
        });

        const duplicate = allPackages.find(
          (pkg) => this.normalizePackageKey(pkg.package_key) === package_key
        );

        if (duplicate) {
          const error = new Error(
            `Package key already exists as "${duplicate.package_key}". Package keys are case-insensitive.`
          );
          error.code = "DUPLICATE_KEY";
          error.statusCode = 409;
          throw error;
        }
      }
    }

    if (package_name) {
      package_name = package_name.trim();
    }

    return await prisma.package.update({
      where: { package_id: packageId },
      data: {
        ...(package_key && { package_key }),
        ...(package_name && { package_name }),
      },
      select: {
        package_id: true,
        package_key: true,
        package_name: true,
        created_at: true,
      },
    });
  }

  async deletePackage(packageId) {
    const existing = await prisma.package.findUnique({
      where: { package_id: packageId },
      include: { _count: { select: { owners: true } } },
    });

    if (!existing) {
      const error = new Error("Package not found.");
      error.code = "NOT_FOUND";
      error.statusCode = 404;
      throw error;
    }

    // Prevent deletion if package has owners
    if (existing._count.owners > 0) {
      const error = new Error(
        `Cannot delete package. ${existing._count.owners} owner(s) are using this package.`
      );
      error.code = "HAS_OWNERS";
      error.statusCode = 400;
      throw error;
    }

    await prisma.package.delete({
      where: { package_id: packageId },
    });

    return { message: "Package deleted successfully." };
  }
}

export default new PackageService();
