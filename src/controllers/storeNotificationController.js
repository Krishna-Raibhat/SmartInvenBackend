// src/controllers/storeNotificationController.js
import { prisma } from "../prisma/client.js";
import storeNotificationPreferenceService from "../services/storeNotificationPreferenceService.js";
const fail = (res, s, c, m) =>
  res.status(s).json({ success: false, error_code: c, message: m });

export const list = async (req, res) => {
  try {
    const owner_id = req.owner.owner_id;

    const notifications = await prisma.storeNotification.findMany({
      where: { owner_id },
      orderBy: { created_at: "desc" },
      take: 100,
    });

    const unreadCount = await prisma.storeNotification.count({
      where: { owner_id, read_at: null },
    });

    res.json({ success: true, data: notifications, unreadCount });
  } catch (e) {
    fail(res, 500, "SERVER_ERROR", e.message);
  }
};

export const markRead = async (req, res) => {
  try {
    const owner_id = req.owner.owner_id;
    const { id } = req.params;

    const n = await prisma.storeNotification.findFirst({
      where: { notification_id: id, owner_id },
    });
    if (!n) return fail(res, 404, "NOT_FOUND", "Notification not found");

    const updated = await prisma.storeNotification.update({
      where: { notification_id: id },
      data: { read_at: new Date() },
    });

    res.json({ success: true, data: updated });
  } catch (e) {
    fail(res, 500, "SERVER_ERROR", e.message);
  }
};

export const markAllRead = async (req, res) => {
  try {
    const owner_id = req.owner.owner_id;

    await prisma.storeNotification.updateMany({
      where: { owner_id, read_at: null },
      data: { read_at: new Date() },
    });

    res.json({ success: true, message: "All notifications marked read" });
  } catch (e) {
    fail(res, 500, "SERVER_ERROR", e.message);
  }
};

export const deleteOne = async (req, res) => {
  try {
    const owner_id = req.owner.owner_id;
    const { id } = req.params;

    const n = await prisma.storeNotification.findFirst({
      where: { notification_id: id, owner_id },
      select: { notification_id: true },
    });

    if (!n) return fail(res, 404, "NOT_FOUND", "Notification not found");

    await prisma.storeNotification.delete({
      where: { notification_id: id },
    });

    res.json({ success: true, message: "Deleted" });
  } catch (e) {
    fail(res, 500, "SERVER_ERROR", e.message);
  }
};

// Preference handlers
export const getPreferences = async (req, res) => {
  try {
    const owner_id = req.owner.owner_id;
    const preferences = await storeNotificationPreferenceService.getAllPreferences(owner_id);
    res.json({ success: true, data: preferences });
  } catch (e) {
    fail(res, 500, "SERVER_ERROR", e.message);
  }
};

export const updatePreference = async (req, res) => {
  try {
    const owner_id = req.owner.owner_id;
    const { type, is_enabled } = req.body;

    const validTypes = ["low_stock"];
    if (!type || !validTypes.includes(type)) {
      return fail(res, 400, "INVALID_TYPE", `type must be one of: ${validTypes.join(", ")}`);
    }
    if (typeof is_enabled !== "boolean") {
      return fail(res, 400, "INVALID_VALUE", "is_enabled must be a boolean");
    }

    const result = await storeNotificationPreferenceService.setPreference(owner_id, type, is_enabled);

    // Fix: when re-enabling low_stock, reset cooldown so alerts fire on the next cron run
    if (type === "low_stock" && is_enabled === true) {
      await prisma.storeProduct.updateMany({
        where: { owner_id, type: "item", last_low_stock_notified_at: { not: null } },
        data: { last_low_stock_notified_at: null },
      });
    }

    res.json({ success: true, data: result });
  } catch (e) {
    fail(res, 500, "SERVER_ERROR", e.message);
  }
};

// Threshold handlers
export const getThreshold = async (req, res) => {
  try {
    const owner_id = req.owner.owner_id;
    const type = req.query.type || "low_stock";

    const validTypes = ["low_stock"];
    if (!validTypes.includes(type)) {
      return fail(res, 400, "INVALID_TYPE", `type must be one of: ${validTypes.join(", ")}`);
    }

    const threshold = await storeNotificationPreferenceService.getThreshold(owner_id, type);
    res.json({ success: true, data: { type, threshold } });
  } catch (e) {
    fail(res, 500, "SERVER_ERROR", e.message);
  }
};

export const updateThreshold = async (req, res) => {
  try {
    const owner_id = req.owner.owner_id;
    const { type = "low_stock", threshold } = req.body;

    const validTypes = ["low_stock"];
    if (!validTypes.includes(type)) {
      return fail(res, 400, "INVALID_TYPE", `type must be one of: ${validTypes.join(", ")}`);
    }

    const value = Number(threshold);
    if (!Number.isInteger(value) || value <= 0) {
      return fail(res, 400, "INVALID_VALUE", "threshold must be a positive integer");
    }

    const result = await storeNotificationPreferenceService.setThreshold(owner_id, type, value);

    if (type === "low_stock") {
      await prisma.storeProduct.updateMany({
        where: { owner_id, type: "item", last_low_stock_notified_at: { not: null } },
        data: { last_low_stock_notified_at: null },
      });
    }

    res.json({ success: true, data: { type: result.type, threshold: result.threshold } });
  } catch (e) {
    fail(res, 500, "SERVER_ERROR", e.message);
  }
};