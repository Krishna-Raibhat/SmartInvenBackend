// src/controllers/storeSaleDaybookController.js
import storeSaleDaybookService from "../services/storesaledaybookservice.js";
import { sendSuccess, sendError } from "../utils/apiResponse.js";

export const getDaybook = async (req, res) => {
  try {
    const owner_id = req.owner.owner_id;
    const { date, from, to } = req.query;

    if (from || to) {
      if (!from || !to) {
        return sendError(res, 400, "VALIDATION_RANGE_INCOMPLETE", "Both 'from' and 'to' are required for a range query.");
      }
      const data = await storeSaleDaybookService.getDaybookRange(owner_id, from, to);
      return sendSuccess(res, 200, "OK", data);
    }

    const data = await storeSaleDaybookService.getDaybook(owner_id, date);
    return sendSuccess(res, 200, "OK", data);
  } catch (err) {
    if (err.status) {
      return sendError(res, err.status, err.code || "ERROR", err.message);
    }
    console.error("Error fetching store sale daybook:", err);
    return sendError(res, 500, "SERVER_ERROR", "Failed to fetch daybook.");
  }
};