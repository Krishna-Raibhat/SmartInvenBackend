const hardwareProfitLossService = require("../services/hardwareProfitLossService");

class HardwareProfitLossController {

  async getProfitLoss(req, res, next) {
    try {
        // Extract owner_id from authenticated user
      const owner_id = req.owner?.owner_id;
      
      // Ensure user is authenticated
      if (!owner_id) {
        return res.status(401).json({
          success: false,
          message: "Unauthorized access",
          code: "UNAUTHORIZED",
        });
      }

  

      /* Validate period existence early (optional but helpful)
      if (!type) {
        return res.status(400).json({
          success: false,
          message: "Type is required",
          code: "TYPE_REQUIRED",
        });
      }*/


      const {start_date, end_date} = req.query

      const result = await hardwareProfitLossService.getProfitLoss({
        owner_id,
        start_date,
        end_date,
      });

      // Send success response
      res.status(200).json({
        success: true,
        data: result,
      });

    } catch (error) {
      // Handle known application errors
      if (error.status && error.code) {
        return res.status(error.status).json({
          success: false,
          message: error.message,
          code: error.code,
        });
      }

      // Pass unknown errors to global error handler
      next(error);
    }
  }
}

module.exports = new HardwareProfitLossController();
