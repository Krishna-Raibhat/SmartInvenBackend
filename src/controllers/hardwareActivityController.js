// src/controllers/hardwareActivityController.js
import hardwareActivityService from "../services/hardwareActivityService.js";
import { sendSuccess, sendError } from "../utils/apiResponse.js";

export const getRecentActivities = async (req, res) => {
  try {
    const owner_id = req.owner.owner_id;
    const limit = req.query.limit ? Number(req.query.limit) : 4;

    const activities = await hardwareActivityService.listRecent(owner_id, limit);

    return sendSuccess(res, 200,"OK", { activities });
  } catch (err) {
    return sendError(res, 500, "SERVER_ERROR", err.message);
  }
};
