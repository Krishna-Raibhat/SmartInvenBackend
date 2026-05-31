// src/services/groceryNotificationPreferenceService.js
import prisma from "../config/prisma.js";

class GroceryNotificationPreferenceService {
  /**
   * Get notification preference for a specific type
   * Returns the latest preference for the given type
   * Defaults to true if no preference exists
   */
  async getPreference(owner_id, type) {
    const lastPref = await prisma.groceryNotification.findFirst({
      where: {
        owner_id,
        type,
      },
      orderBy: {
        created_at: 'desc',
      },
      select: {
        is_enabled: true,
      },
    });

    // Default to enabled if no preference exists
    return lastPref?.is_enabled ?? true;
  }

  /**
   * Set notification preference for a specific type
   * Creates a preference record
   */
  async setPreference(owner_id, type, is_enabled) {
    const preferenceTitle = `${type} preference`;
    const preferenceMessage = `Notifications ${is_enabled ? 'enabled' : 'disabled'}`;

    const preference = await prisma.groceryNotification.create({
      data: {
        owner_id,
        type,
        title: preferenceTitle,
        message: preferenceMessage,
        is_enabled,
      },
    });

    return preference;
  }

  /**
   * Check if notification should be sent
   * Returns false if user has disabled this notification type
   */
  async shouldSendNotification(owner_id, type) {
    const isEnabled = await this.getPreference(owner_id, type);
    return isEnabled;
  }

  /**
   * Get all notification preferences for a user
   * Returns the latest preference for each notification type
   * 
   * Supported types:
   * - low_stock: Low stock alerts
   * - expiry: Product expiry warnings
   */
  async getAllPreferences(owner_id) {
    const types = ['low_stock', 'expiry'];
    const preferences = {};

    for (const type of types) {
      preferences[type] = await this.getPreference(owner_id, type);
    }

    return preferences;
  }

  /**
   * Update multiple preferences at once
   */
  async updateMultiplePreferences(owner_id, preferencesMap) {
    const results = [];

    for (const [type, is_enabled] of Object.entries(preferencesMap)) {
      const result = await this.setPreference(owner_id, type, is_enabled);
      results.push(result);
    }

    return results;
  }
}

export default new GroceryNotificationPreferenceService();
