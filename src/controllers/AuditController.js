const auditService = require('../services/auditService');

class AuditController {
  async getAuditLogs(req, res) {
    try {
      const { limit = 100, offset = 0 } = req.query;

      const logs = await auditService.getAuditTrail(
        new Date(new Date().setDate(new Date().getDate() - 30)), // Last 30 days
        new Date(),
        limit
      );

      res.json({
        success: true,
        data: logs,
      });
    } catch (error) {
      console.error('Error fetching audit logs:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch audit logs' });
    }
  }

  async getAuditTrail(req, res) {
    try {
      const { startDate, endDate, limit = 100 } = req.query;

      const trail = await auditService.getAuditTrail(new Date(startDate), new Date(endDate), limit);

      res.json({
        success: true,
        data: trail,
      });
    } catch (error) {
      console.error('Error fetching audit trail:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch audit trail' });
    }
  }

  async getUserActivity(req, res) {
    try {
      const { userId } = req.params;
      const { limit = 50 } = req.query;

      const activity = await auditService.getUserHistory(userId, limit);

      res.json({
        success: true,
        data: activity,
      });
    } catch (error) {
      console.error('Error fetching user activity:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch user activity' });
    }
  }

  async getAuditReport(req, res) {
    try {
      const { startDate, endDate } = req.query;

      const report = await auditService.generateAuditReport(new Date(startDate), new Date(endDate));

      res.json({
        success: true,
        data: report,
      });
    } catch (error) {
      console.error('Error generating audit report:', error);
      res.status(500).json({ success: false, error: 'Failed to generate audit report' });
    }
  }

  async getResourceHistory(req, res) {
    try {
      const { resourceType, resourceId } = req.query;

      const history = await auditService.getResourceHistory(resourceType, resourceId);

      res.json({
        success: true,
        data: history,
      });
    } catch (error) {
      console.error('Error fetching resource history:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch resource history' });
    }
  }
}

module.exports = new AuditController();
