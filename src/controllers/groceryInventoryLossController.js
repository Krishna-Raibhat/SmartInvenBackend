// src/controllers/groceryInventoryLossController.js
import groceryInventoryLossService from "../services/groceryInventoryLossService.js";

class GroceryInventoryLossController {
  async create(req, res) {
    try {
      const owner_id = req.user?.owner_id;
      if (!owner_id) {
        return res.status(401).json({
          success: false,
          message: "Unauthorized",
        });
      }

      const result = await groceryInventoryLossService.recordLoss(
        owner_id,
        req.body
      );

      return res.status(201).json({
        success: true,
        data: result,
        message: result.message,
      });
    } catch (error) {
      console.error("Error recording inventory loss:", error);
      return res.status(error.status || 500).json({
        success: false,
        message: error.message || "Failed to record inventory loss",
        code: error.code,
      });
    }
  }

  async list(req, res) {
    try {
      const owner_id = req.user?.owner_id;
      if (!owner_id) {
        return res.status(401).json({
          success: false,
          message: "Unauthorized",
        });
      }

      const { start, end } = req.query;
      const losses = await groceryInventoryLossService.listLosses(owner_id, {
        start,
        end,
      });

      return res.json({
        success: true,
        data: losses,
      });
    } catch (error) {
      console.error("Error listing inventory losses:", error);
      return res.status(500).json({
        success: false,
        message: error.message || "Failed to list inventory losses",
      });
    }
  }

  async summary(req, res) {
    try {
      const owner_id = req.user?.owner_id;
      if (!owner_id) {
        return res.status(401).json({
          success: false,
          message: "Unauthorized",
        });
      }

      const { start, end } = req.query;
      const summary = await groceryInventoryLossService.getSummary(owner_id, {
        start,
        end,
      });

      return res.json({
        success: true,
        data: summary,
      });
    } catch (error) {
      console.error("Error getting loss summary:", error);
      return res.status(500).json({
        success: false,
        message: error.message || "Failed to get loss summary",
      });
    }
  }
}

export default new GroceryInventoryLossController();
