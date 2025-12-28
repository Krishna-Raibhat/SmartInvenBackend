const prisma = require("../prisma/client");

const fail = (res, status, error_code, message) =>
  res.status(status).json({ success: false, error_code, message });

exports.list = async (req, res) => {
  try {
    const owner_id = req.owner.owner_id;

    const notifications = await prisma.hardwareNotification.findMany({
      where: { owner_id },
      orderBy: { created_at: "desc" },
      take: 100,
    });

    const unreadCount = await prisma.hardwareNotification.count({
      where: { owner_id, read_at: null },
    });

    return res.json({ success: true, data: notifications, unreadCount });
  } catch (e) {
    return fail(res, 500, "SERVER_ERROR", e.message);
  }
};

exports.markRead = async (req, res) => {
  try {
    const owner_id = req.owner.owner_id;
    const id = req.params.id;

    const n = await prisma.hardwareNotification.findFirst({
      where: { notification_id: id, owner_id },
    });
    if (!n) return fail(res, 404, "NOT_FOUND", "Notification not found");

    const updated = await prisma.hardwareNotification.update({
      where: { notification_id: id },
      data: { read_at: new Date() },
    });

    return res.json({ success: true, data: updated });
  } catch (e) {
    return fail(res, 500, "SERVER_ERROR", e.message);
  }
};

exports.markAllRead = async (req, res) => {
  try {
    const owner_id = req.owner.owner_id;

    await prisma.hardwareNotification.updateMany({
      where: { owner_id, read_at: null },
      data: { read_at: new Date() },
    });

    return res.json({ success: true, message: "All notifications marked read" });
  } catch (e) {
    return fail(res, 500, "SERVER_ERROR", e.message);
  }
};

exports.deleteOne = async (req, res) => {
  try {
    const owner_id = req.owner.owner_id;
    const id = req.params.id;

    const n = await prisma.hardwareNotification.findFirst({
      where: { notification_id: id, owner_id },
      select: { notification_id: true },
    });
    if (!n) return fail(res, 404, "NOT_FOUND", "Notification not found");

    await prisma.hardwareNotification.delete({
      where: { notification_id: id },
    });

    return res.json({ success: true, message: "Deleted" });
  } catch (e) {
    return fail(res, 500, "SERVER_ERROR", e.message);
  }
};
