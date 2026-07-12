import prisma from "../prisma/client.js";

const fail = (res, s, c, m) =>
  res.status(s).json({ success: false, error_code: c, message: m });

export const list = async (req, res) => {
  try {
    const owner_id = req.owner.owner_id;

    const notifications = await prisma.groceryNotification.findMany({
      where: { owner_id },
      orderBy: { created_at: "desc" },
      take: 100,
    });

    const unreadCount = await prisma.groceryNotification.count({
      where: { owner_id, read_at: null },
    });

    res.json({ success: true, data: notifications, unreadCount });
  } catch (e) {
    fail(res, 500, "SERVER_ERROR", e.message);
  }
};

export const markRead = async (req, res) => {
  try {
    const { owner_id } = req.owner;
    const { id } = req.params;

    const n = await prisma.groceryNotification.findFirst({
      where: { notification_id: id, owner_id },
    });
    if (!n) return fail(res, 404, "NOT_FOUND", "Notification not found");

    const updated = await prisma.groceryNotification.update({
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

    await prisma.groceryNotification.updateMany({
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

    const n = await prisma.groceryNotification.findFirst({
      where: { notification_id: id, owner_id },
      select: { notification_id: true },
    });

    if (!n)
      return fail(res, 404, "NOT_FOUND", "Notification not found");

    await prisma.groceryNotification.delete({
      where: { notification_id: id },
    });

    return res.json({ success: true, message: "Deleted" });
  } catch (e) {
    return fail(res, 500, "SERVER_ERROR", e.message);
  }
};
