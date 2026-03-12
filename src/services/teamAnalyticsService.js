const pool = require('../config/database');

class TeamAnalyticsService {
  async getTeamAttendanceStats(departmentId, startDate, endDate) {
    try {
      const stats = await pool.query(
        `SELECT 
          COUNT(DISTINCT a.employee_id) as total_employees,
          COUNT(DISTINCT CASE WHEN a.check_out_time IS NOT NULL THEN a.employee_id END) as full_day_employees,
          AVG(a.hours_worked) as avg_hours_per_day,
          MIN(a.hours_worked) as min_hours,
          MAX(a.hours_worked) as max_hours
        FROM attendance a
        JOIN employees e ON a.employee_id = e.id
        WHERE e.department = $1 AND a.date BETWEEN $2 AND $3`,
        [departmentId, startDate, endDate]
      );

      return stats.rows[0];
    } catch (error) {
      console.error('Failed to get team attendance stats:', error);
      throw error;
    }
  }

  async getTeamProductivityStats(departmentId, startDate, endDate) {
    try {
      const stats = await pool.query(
        `SELECT 
          COUNT(*) as total_tasks,
          COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_tasks,
          COUNT(DISTINCT employee_id) as total_employees,
          AVG(completion_percentage) as avg_completion,
          COUNT(CASE WHEN priority = 'high' THEN 1 END) as high_priority_tasks
        FROM tasks
        WHERE employee_id IN (SELECT id FROM employees WHERE department = $1)
        AND created_at BETWEEN $2 AND $3`,
        [departmentId, startDate, endDate]
      );

      return stats.rows[0];
    } catch (error) {
      console.error('Failed to get team productivity stats:', error);
      throw error;
    }
  }

  async getEmployeeComparison(departmentId, startDate, endDate) {
    try {
      const results = await pool.query(
        `SELECT 
          e.id,
          e.first_name,
          e.last_name,
          COUNT(DISTINCT a.date) as days_worked,
          AVG(a.hours_worked) as avg_hours,
          COUNT(DISTINCT t.id) as total_tasks,
          COUNT(DISTINCT CASE WHEN t.status = 'completed' THEN t.id END) as completed_tasks,
          ROUND(AVG(t.completion_percentage)::NUMERIC, 2) as avg_completion
        FROM employees e
        LEFT JOIN attendance a ON e.id = a.employee_id AND a.date BETWEEN $2 AND $3
        LEFT JOIN tasks t ON e.id = t.employee_id AND t.created_at BETWEEN $2 AND $3
        WHERE e.department = $1 AND e.is_active = true
        GROUP BY e.id, e.first_name, e.last_name
        ORDER BY avg_hours DESC`,
        [departmentId, startDate, endDate]
      );

      return results.rows;
    } catch (error) {
      console.error('Failed to get employee comparison:', error);
      throw error;
    }
  }

  async getTeamMeetingStats(departmentId, startDate, endDate) {
    try {
      const stats = await pool.query(
        `SELECT 
          COUNT(*) as total_meetings,
          SUM(duration_minutes) as total_duration,
          AVG(duration_minutes) as avg_duration,
          AVG(attendees) as avg_attendees,
          COUNT(DISTINCT employee_id) as employees_with_meetings
        FROM meetings
        WHERE employee_id IN (SELECT id FROM employees WHERE department = $1)
        AND meeting_date BETWEEN $2 AND $3`,
        [departmentId, startDate, endDate]
      );

      return stats.rows[0];
    } catch (error) {
      console.error('Failed to get team meeting stats:', error);
      throw error;
    }
  }

  async getTeamHealthScore(departmentId, startDate, endDate) {
    try {
      const attendance = await this.getTeamAttendanceStats(departmentId, startDate, endDate);
      const productivity = await this.getTeamProductivityStats(departmentId, startDate, endDate);

      // Attendance score: 50%
      const attendanceScore = (attendance.full_day_employees / attendance.total_employees) * 50;

      // Productivity score: 50%
      const productivityScore = (productivity.completed_tasks / productivity.total_tasks) * 50;

      const healthScore = Math.round(attendanceScore + productivityScore);

      return {
        healthScore,
        attendanceScore: Math.round(attendanceScore),
        productivityScore: Math.round(productivityScore),
        status: healthScore >= 80 ? 'Сайн' : healthScore >= 60 ? 'Дунд' : 'Муу',
      };
    } catch (error) {
      console.error('Failed to calculate team health score:', error);
      throw error;
    }
  }
}

module.exports = new TeamAnalyticsService();
