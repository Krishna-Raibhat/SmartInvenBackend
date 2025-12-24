
const stockOutCreditService = require("../services/stockOutCreditService");

const validateOwner = (res, owner_id) => {
  if (!owner_id) {
    return res.status(400).json({
      success: false,
      message: "OWNER_ID_REQUIRED",
      error: "Owner ID is required.",
    });
    
  }
  
};

// GET /api/stock-out/credit
exports.getStockOutCredits = async (req, res) => {
  try {
    
    const owner_id = req.owner.owner_id;
  
    validateOwner(res,owner_id);

    const credits = await stockOutCreditService.getStockOutWithCreditLeft(
      owner_id
    );

    return res.status(200).json({ success: true, data: credits });
  } catch (error) {
    return res
      .status(500)
      .json({ success: false, message: "SERVER_ERROR", error: error.message });
  }
};
