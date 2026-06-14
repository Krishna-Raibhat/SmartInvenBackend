// src/services/storeNotificationPreferenceService.js
// Uses a dedicated StoreNotificationPreference table — one row per owner+type.
// This avoids polluting the notifications list and eliminates stale preference rows.
import { prisma } from "../prisma/client.js";

const VALID_TYPES = ["low_stock"];

class StoreNotificationPreferenceService {
  /**
   * Get is_enabled for a given type. Defaults to true if no row exists yet.
   */
  async getPreference(owner_id, type) {
    const pref = await prisma.storeNotificationPreference.findUnique({
      where: { owner_id_type: { owner_id, type } },
      select: { is_enabled: true },
    });
    return pref?.is_enabled ?? true;
  }

  /**
   * Upsert the preference — one row per owner+type, always up-to-date.
   */
  async setPreference(owner_id, type, is_enabled) {
    return prisma.storeNotificationPreference.upsert({
      where: { owner_id_type: { owner_id, type } },
      update: { is_enabled },
      create: { owner_id, type, is_enabled },
    });
  }

  /**
   * Used by the notification service before sending — returns boolean.
   */
  async shouldSendNotification(owner_id, type) {
    return this.getPreference(owner_id, type);
  }

  /**
   * Returns all preference types with their current is_enabled value.
   */
  async getAllPreferences(owner_id) {
    const rows = await prisma.storeNotificationPreference.findMany({
      where: { owner_id },
      select: { type: true, is_enabled: true },
    });

    // Build map from DB rows, fill in defaults for types not yet set
    const map = Object.fromEntries(rows.map((r) => [r.type, r.is_enabled]));
    for (const type of VALID_TYPES) {
      if (!(type in map)) map[type] = true; // default enabled
    }
    return map;
  }
}

export default new StoreNotificationPreferenceService();
