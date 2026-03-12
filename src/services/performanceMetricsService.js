const pool = require('../config/database');

class PerformanceMetricsService {
  async getEmployeeKPI(employeeId, startDate, endDate) {
    try {
      // Attendance KPI
      const attendance = await pool.query(
        `SELECT 
          COUNT(*) as total_days,
          COUNT(CASE WHEN check_out_time IS NOT NULL THEN 1 END) as full_days,
          AVG(hours_worked) as avg_hours,
          SUM(hours_worked) as total_hours
        FROM attendance 
        WHERE employee_id = $1 AND date BETWEEN $2 AND $3`,
        [employeeId, startDate, endDate]
      );

      // Task KPI
      const tasks = await pool.query(
        `SELECT 
          COUNT(*) as total_tasks,
          COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_tasks,
          AVG(completion_percentage) as avg_completion,
          COUNT(CASE WHEN priority = 'high' AND status = 'completed' THEN 1 END) as high_priority_completed
        FROM tasks
        WHERE employee_id = $1 AND created_at BETWEEN $2 AND $3`,
        [employeeId, startDate, endDate]
      );

      // Meeting KPI
      const meetings = await pool.query(
        `SELECT 
          COUNT(*) as total_meetings,
          SUM(duration_minutes) as total_duration,
          AVG(attendees) as avg_attendees
        FROM meetings
        WHERE employee_id = $1 AND meeting_date BETWEEN $2 AND $3`,
        [employeeId, startDate, endDate]
      );

      return {
        attendance: attendance.rows[0],
        tasks: tasks.rows[0],
        meetings: meetings.rows[0],
        calculatedKPIs: this.calculateKPIs(attendance.rows[0], tasks.rows[0]),
      };
    } catch (error) {
      console.error('Failed to get employee KPI:', error);
      throw error;
    }
  }

  calculateKPIs(attendance, tasks) {
    const kpis = {};

    // Attendance Rate
    if (attendance.total_days > 0) {
      kpis.attendanceRate = Math.round((attendance.full_days / attendance.total_days) * 100);
    }

    // Task Completion Rate
    if (tasks.total_tasks > 0) {
      kpis.taskCompletionRate = Math.round((tasks.completed_tasks / tasks.total_tasks) * 100);
    }

    // Average Task Completion %
    kpis.avgTaskCompletion = Math.round(tasks.avg_completion || 0);

    // High Priority Task Completion
    kpis.highPriorityCompletion = tasks.high_priority_completed || 0;

    // Average Daily Hours
    kpis.avgDailyHours = Math.round(attendance.avg_hours || 0 * 10) / 10;

    return kpis;
  }

  async getDepartmentKPIs(departmentId, startDate, endDate) {
    try {
      const employees = await pool.query(
        'SELECT id FROM employees WHERE department = $1 AND is_active = true',
        [departmentId]
      );

      const employeeIds = employees.rows.map(e => e.id);

      if (employeeIds.length === 0) {
        return { error: 'No active employees in this department' };
      }

      const attendance = await pool.query(
        `SELECT 
          AVG(hours_worked) as avg_hours,
          COUNT(DISTINCT employee_id) as employees_attended
        FROM attendance 
        WHERE employee_id = ANY($1) AND date BETWEEN $2 AND $3`,
        [employeeIds, startDate, endDate]
      );

      const tasks = await pool.query(
        `SELECT 
          COUNT(*) as total_tasks,
          COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_tasks,
          AVG(completion_percentage) as avg_completion
        FROM tasks
        WHERE employee_id = ANY($1) AND created_at BETWEEN $2 AND $3`,
        [employeeIds, startDate, endDate]
      );

      return {
        departmentId,
        totalEmployees: employeeIds.length,
        attendanceMetrics: attendance.rows[0],
        taskMetrics: tasks.rows[0],
      };
    } catch (error) {
      console.error('Failed to get department KPIs:', error);
      throw error;
    }
  }

  async getCompanyMetrics(startDate, endDate) {
    try {
      const allMetrics = await pool.query(
        `SELECT 
          COUNT(DISTINCT e.id) as total_employees,
          COUNT(DISTINCT a.employee_id) as employees_with_attendance,
          AVG(a.hours_worked) as avg_hours,
          COUNT(DISTINCT t.id) as total_tasks,
          COUNT(DISTINCT CASE WHEN t.status = 'completed' THEN t.id END) as completed_tasks
        FROM employees e
        LEFT JOIN attendance a ON e.id = a.employee_id AND a.date BETWEEN $1 AND $2
        LEFT JOIN tasks t ON e.id = t.employee_id AND t.created_at BETWEEN $1 AND $2
        WHERE e.is_active = true`,
        [startDate, endDate]
      );

      const metrics = allMetrics.rows[0];
      return {
        totalEmployees: metrics.total_employees,
        attendanceRate: Math.round((metrics.employees_with_attendance / metrics.total_employees) * 100),
        avgHoursPerDay: Math.round(metrics.avg_hours * 10) / 10,
        taskCompletionRate: Math.round((metrics.completed_tasks / metrics.total_tasks) * 100),
        totalTasks: metrics.total_tasks,
        completedTasks: metrics.completed_tasks,
      };
    } catch (error) {
      console.error('Failed to get company metrics:', error);
      throw error;
    }
  }
}

module.exports = new PerformanceMetricsService();
