// src/controllers/clothingActivityController.js
const service = require("../services/clothingActivityService");

const fail = (res, s, c, m) => res.status(s).json({ success: false, error_code: c, message: m });

exports.list = async (req, res) => {
  try {
    const owner_id = req.owner.owner_id;
    const limit = Number(req.query.limit ?? 4);

    const data = await service.listRecent(owner_id, limit);
    return res.json({ success: true, data });
  } catch (e) {
    return fail(res, e.status || 500, e.code || "SERVER_ERROR", e.message);
  }
};
