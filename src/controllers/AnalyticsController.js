const teamAnalyticsService = require('../services/teamAnalyticsService');
const performanceMetricsService = require('../services/performanceMetricsService');
const predictiveService = require('../services/predictiveService');
const meetingStatsService = require('../services/meetingStatsService');

class AnalyticsController {
  static async getTeamStats(req, res) {
    try {
      const { departmentId, startDate, endDate } = req.query;

      const attendanceStats = await teamAnalyticsService.getTeamAttendanceStats(departmentId, startDate, endDate);
      const productivityStats = await teamAnalyticsService.getTeamProductivityStats(departmentId, startDate, endDate);
      const healthScore = await teamAnalyticsService.getTeamHealthScore(departmentId, startDate, endDate);

      res.json({
        success: true,
        data: {
          attendance: attendanceStats,
          productivity: productivityStats,
          health: healthScore,
        },
      });
    } catch (error) {
      console.error('Error fetching team stats:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch team statistics' });
    }
  }

  static async getEmployeeComparison(req, res) {
    try {
      const { departmentId, startDate, endDate } = req.query;

      const comparison = await teamAnalyticsService.getEmployeeComparison(departmentId, startDate, endDate);

      res.json({
        success: true,
        data: comparison,
      });
    } catch (error) {
      console.error('Error fetching employee comparison:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch employee comparison' });
    }
  }

  static async getTeamMeetingStats(req, res) {
    try {
      const { departmentId, startDate, endDate } = req.query;

      const meetings = await teamAnalyticsService.getTeamMeetingStats(departmentId, startDate, endDate);

      res.json({
        success: true,
        data: meetings,
      });
    } catch (error) {
      console.error('Error fetching meeting stats:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch meeting statistics' });
    }
  }

  static async getEmployeeKPI(req, res) {
    try {
      const { employeeId, startDate, endDate } = req.query;

      const kpi = await performanceMetricsService.getEmployeeKPI(employeeId, startDate, endDate);

      res.json({
        success: true,
        data: kpi,
      });
    } catch (error) {
      console.error('Error fetching employee KPI:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch employee KPI' });
    }
  }

  static async getDepartmentKPIs(req, res) {
    try {
      const { departmentId, startDate, endDate } = req.query;

      const kpis = await performanceMetricsService.getDepartmentKPIs(departmentId, startDate, endDate);

      res.json({
        success: true,
        data: kpis,
      });
    } catch (error) {
      console.error('Error fetching department KPIs:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch department KPIs' });
    }
  }

  static async getCompanyMetrics(req, res) {
    try {
      const { startDate, endDate } = req.query;

      const metrics = await performanceMetricsService.getCompanyMetrics(startDate, endDate);

      res.json({
        success: true,
        data: metrics,
      });
    } catch (error) {
      console.error('Error fetching company metrics:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch company metrics' });
    }
  }

  static async getPredictiveInsights(req, res) {
    try {
      const employeeId = req.employee ? req.employee.id : null;
      const insights = predictiveService.getPredictiveInsights(employeeId);
      res.json({ success: true, data: insights });
    } catch (error) {
      res.status(500).json({ success: false, error: 'AI insights error' });
    }
  }

  static async getMeetingStats(req, res) {
    try {
      const employeeId = req.employee ? req.employee.id : null;
      const stats = await meetingStatsService.getMeetingStats(employeeId);
      res.json({ success: true, data: stats });
    } catch (error) {
      res.status(500).json({ success: false, error: 'Meeting stats error' });
    }
  }

  static async getMeetingStatsWidget(req, res) {
    return this.getMeetingStats(req, res);
  }
}

module.exports = AnalyticsController;
