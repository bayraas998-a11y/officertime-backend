const pool = require('../config/database');
const ReportGenerator = require('../services/reportGenerator');
const { isLeaderRole } = require('../utils/role');

class ReportController {
  static assertReportAccess(req, employeeId) {
    const requested = Number(employeeId);
    if (!requested) return { ok: false, status: 400, body: { error: 'employeeId is required' } };

    const isSelf = requested === Number(req.employee?.id);
    if (isSelf) return { ok: true, employeeId: requested };
    if (isLeaderRole(req.employee?.role)) return { ok: true, employeeId: requested };

    return { ok: false, status: 403, body: { message: 'Эрх хүрэхгүй байна.' } };
  }

  static async getEmployeeReport(req, res) {
    try {
      const { employeeId, startDate, endDate } = req.query;
      const access = this.assertReportAccess(req, employeeId);
      if (!access.ok) return res.status(access.status).json(access.body);

      const attendance = await pool.query(
        'SELECT COUNT(*) as total_days, COUNT(check_out_time) as days_worked, AVG(hours_worked) as avg_hours FROM attendance WHERE employee_id = ? AND date BETWEEN ? AND ?',
        [access.employeeId, startDate, endDate]
      );

      const meetings = await pool.query(
        'SELECT COUNT(*) as total_meetings, SUM(attendees) as total_attendees FROM meetings WHERE employee_id = ? AND meeting_date BETWEEN ? AND ?',
        [access.employeeId, startDate, endDate]
      );

      const tasks = await pool.query(
        "SELECT COUNT(*) as total_tasks, COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_tasks FROM tasks WHERE employee_id = ? AND created_at BETWEEN ? AND ?",
        [access.employeeId, startDate, endDate]
      );

      res.json({
        attendance: attendance.rows[0],
        meetings: meetings.rows[0],
        tasks: tasks.rows[0],
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  static async generatePDFReport(req, res) {
    try {
      const { employeeId, startDate, endDate } = req.body;
      const access = this.assertReportAccess(req, employeeId);
      if (!access.ok) return res.status(access.status).json(access.body);

      await ReportGenerator.generatePDFReport(access.employeeId, startDate, endDate, res);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  static async generateExcelReport(req, res) {
    try {
      const { employeeId, startDate, endDate } = req.body;
      const access = this.assertReportAccess(req, employeeId);
      if (!access.ok) return res.status(access.status).json(access.body);

      await ReportGenerator.generateExcelReport(access.employeeId, startDate, endDate, res);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
}

module.exports = ReportController;

