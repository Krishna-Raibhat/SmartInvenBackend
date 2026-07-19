import { prisma } from "../prisma/client.js";

export const create = async (req, res) => {
  try {
    const owner_id = req.owner.owner_id;
    const { item_name, reminder_date, notes } = req.body;

    if (!item_name || !reminder_date) {
      return res.status(400).json({
        success: false,
        error_code: "REQUIRED_FIELDS",
        message: "item_name and reminder_date are required.",
      });
    }

    const reminder = await prisma.storeCustomerReminder.create({
      data: {
        owner_id,
        item_name,
        reminder_date: new Date(reminder_date),
        notes,
      },
    });

    return res.status(201).json({ success: true, data: reminder });
  } catch (error) {
    console.error("Error creating customer reminder:", error);
    return res.status(500).json({
      success: false,
      error_code: "SERVER_ERROR",
      message: "Failed to create reminder.",
    });
  }
};

export const list = async (req, res) => {
  try {
    const owner_id = req.owner.owner_id;
    const reminders = await prisma.storeCustomerReminder.findMany({
      where: { owner_id },
      orderBy: { reminder_date: "asc" },
    });
    return res.status(200).json({ success: true, data: reminders });
  } catch (error) {
    console.error("Error listing customer reminders:", error);
    return res.status(500).json({
      success: false,
      error_code: "SERVER_ERROR",
      message: "Failed to fetch reminders.",
    });
  }
};

export const deleteReminder = async (req, res) => {
  try {
    const owner_id = req.owner.owner_id;
    const { id } = req.params;

    const existing = await prisma.storeCustomerReminder.findFirst({
      where: { reminder_id: id, owner_id },
    });

    if (!existing) {
      return res.status(404).json({
        success: false,
        error_code: "NOT_FOUND",
        message: "Reminder not found.",
      });
    }

    await prisma.storeCustomerReminder.delete({
      where: { reminder_id: id },
    });

    return res.status(200).json({ success: true, message: "Reminder deleted." });
  } catch (error) {
    console.error("Error deleting customer reminder:", error);
    return res.status(500).json({
      success: false,
      error_code: "SERVER_ERROR",
      message: "Failed to delete reminder.",
    });
  }
};
