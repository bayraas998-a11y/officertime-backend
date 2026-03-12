const pool = require('../config/database');

class Meeting {
  static async getByEmployee(employeeId, startDate, endDate) {
    const result = await pool.query(
      'SELECT * FROM meetings WHERE employee_id = ? AND meeting_date BETWEEN ? AND ? ORDER BY meeting_date DESC',
      [employeeId, startDate, endDate]
    );
    return result.rows;
  }

  static async create(employeeId, data) {
    const { title, description, meeting_date, duration_minutes, location, attendees } = data;
    const result = await pool.query(
      'INSERT INTO meetings (employee_id, title, description, meeting_date, duration_minutes, location, attendees) VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING *',
      [employeeId, title, description, meeting_date, duration_minutes, location, attendees]
    );
    return result.rows[0];
  }

  static async update(id, data) {
    const { title, description, meeting_date, duration_minutes, location, attendees } = data;
    const result = await pool.query(
      'UPDATE meetings SET title = ?, description = ?, meeting_date = ?, duration_minutes = ?, location = ?, attendees = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? RETURNING *',
      [title, description, meeting_date, duration_minutes, location, attendees, id]
    );
    return result.rows[0];
  }

  static async delete(id) {
    const result = await pool.query('DELETE FROM meetings WHERE id = ? RETURNING *', [id]);
    return result.rows[0];
  }
}

module.exports = Meeting;
