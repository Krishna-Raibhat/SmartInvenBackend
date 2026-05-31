// src/controllers/hardwareActivityController.js
import hardwareActivityService from "../services/hardwareActivityService.js";
import { sendOk, sendFail } from "../utils/apiResponse.js";

export const getRecentActivities = async (req, res) => {
  try {
    const owner_id = req.owner.owner_id;
    const limit = req.query.limit ? Number(req.query.limit) : 4;

    const activities = await hardwareActivityService.listRecent(owner_id, limit);

    return sendOk(res, 200, { activities });
  } catch (err) {
    return sendFail(res, 500, "SERVER_ERROR", err.message);
  }
};
