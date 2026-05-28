// src/controllers/hardwareNotificationPreferenceController.js
import hardwareNotificationPreferenceService from "../services/hardwareNotificationPreferenceService.js";

/**
 * Get all notification preferences for the user
 */
export const getPreferences = async (req, res) => {
  try {
    const owner_id = req.owner.owner_id;

    const preferences = await hardwareNotificationPreferenceService.getAllPreferences(owner_id);

    return res.status(200).json({
      success: true,
      data: preferences,
    });
  } catch (err) {
    console.error("❌ Get preferences error:", err);
    return res.status(500).json({
      success: false,
      message: err.message || "Failed to get preferences",
    });
  }
};

/**
 * Get preference for a specific notification type
 */
export const getPreferenceByType = async (req, res) => {
  try {
    const owner_id = req.owner.owner_id;
    const { type } = req.query;

    if (!type) {
      return res.status(400).json({
        success: false,
        message: "Notification type is required",
      });
    }

    const isEnabled = await hardwareNotificationPreferenceService.getPreference(owner_id, type);

    return res.status(200).json({
      success: true,
      data: {
        type,
        is_enabled: isEnabled,
      },
    });
  } catch (err) {
    console.error("❌ Get preference error:", err);
    return res.status(500).json({
      success: false,
      message: err.message || "Failed to get preference",
    });
  }
};

/**
 * Update notification preference for a specific type
 */
export const updatePreference = async (req, res) => {
  try {
    const owner_id = req.owner.owner_id;
    const { type, is_enabled } = req.body;

    if (!type || is_enabled === undefined) {
      return res.status(400).json({
        success: false,
        message: "Type and is_enabled are required",
      });
    }

    const preference = await hardwareNotificationPreferenceService.setPreference(
      owner_id,
      type,
      is_enabled
    );

    return res.status(200).json({
      success: true,
      message: `${type} notifications ${is_enabled ? 'enabled' : 'disabled'}`,
      data: preference,
    });
  } catch (err) {
    console.error("❌ Update preference error:", err);
    return res.status(500).json({
      success: false,
      message: err.message || "Failed to update preference",
    });
  }
};

/**
 * Update multiple preferences at once
 */
export const updateMultiplePreferences = async (req, res) => {
  try {
    const owner_id = req.owner.owner_id;
    const preferences = req.body; // { low_stock: true, ... }

    if (!preferences || Object.keys(preferences).length === 0) {
      return res.status(400).json({
        success: false,
        message: "At least one preference is required",
      });
    }

    const results = await hardwareNotificationPreferenceService.updateMultiplePreferences(
      owner_id,
      preferences
    );

    return res.status(200).json({
      success: true,
      message: "Preferences updated successfully",
      data: results,
    });
  } catch (err) {
    console.error("❌ Update multiple preferences error:", err);
    return res.status(500).json({
      success: false,
      message: err.message || "Failed to update preferences",
    });
  }
};
