const express = require('express');
const AnalyticsController = require('../controllers/AnalyticsController');
const auth = require('../middleware/auth');
const { requireRoles } = require('../middleware/authorize');

const router = express.Router();

// Protect all analytics endpoints
router.use(auth);

// Team Analytics
router.get('/team-stats', requireRoles(['admin', 'director']), AnalyticsController.getTeamStats);
router.get('/employee-comparison', requireRoles(['admin', 'director']), AnalyticsController.getEmployeeComparison);
router.get('/meeting-stats', AnalyticsController.getMeetingStats);
router.get('/meeting-stats-widget', AnalyticsController.getMeetingStatsWidget);

// Performance Metrics
router.get('/employee-kpi/:employeeId?', requireRoles(['admin', 'director']), AnalyticsController.getEmployeeKPI);
router.get('/department-kpis', requireRoles(['admin', 'director']), AnalyticsController.getDepartmentKPIs);
router.get('/company-metrics', requireRoles(['admin', 'director']), AnalyticsController.getCompanyMetrics);

// AI Predictive Insights
router.get('/predict', requireRoles(['admin', 'director']), AnalyticsController.getPredictiveInsights);

module.exports = router;
