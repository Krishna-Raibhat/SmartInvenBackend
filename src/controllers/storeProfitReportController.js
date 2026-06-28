import storeProfitReportService from '../services/storeProfitReportService.js';

/**
 * Store Profit Report Controller
 */
const storeProfitReportController = {
  /**
   * GET /api/store/reports/profit
   * Get comprehensive profit report
   * Query params: from, to (YYYY-MM-DD format)
   */
  async getReport(req, res) {
    try {
      const owner_id = req.owner.owner_id;
      const { from, to } = req.query;

      if (!from || !to) {
        return res.status(400).json({
          success: false,
          message: 'Missing required parameters: from, to',
        });
      }

      console.log('📊 Profit report request:', { owner_id, from, to });

      const report = await storeProfitReportService.getReport(owner_id, { from, to });

      return res.json({
        success: true,
        ...report,
      });
    } catch (error) {
      console.error('❌ Error generating profit report:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to generate profit report',
        error: error.message,
      });
    }
  }
};

export default storeProfitReportController;
