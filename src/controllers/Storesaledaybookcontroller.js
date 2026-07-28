// src/controllers/storeSaleDaybookController.js
import storeSaleDaybookService from "../services/storeSaleDaybookService.js";
import { sendSuccess, sendError } from "../utils/apiResponse.js";

export const getDaybook = async (req, res) => {
  try {
    const owner_id = req.owner.owner_id;
    const { date } = req.query; // optional "YYYY-MM-DD", defaults to today

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