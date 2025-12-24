const hardwareTopSellingService = require("../services/hardwareTopSellingService");

exports.getTopSellingProducts = async (req, res, next) => {
  try {
    const owner_id = req.owner?.owner_id;

    if (!owner_id) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
        code: "UNAUTHORIZED",
      });
    }

    const { start_date } = req.query;

    const data = await hardwareTopSellingService.getTopSellingProducts({
      owner_id,
      start_date,
    });

    res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
};
