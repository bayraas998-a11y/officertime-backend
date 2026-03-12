const pool = require('../config/database');

class MeetingRequest {
  static async create(createdByEmployeeId, data) {
    const {
      citizen_last_name,
      citizen_first_name,
      citizen_regno,
      citizen_gender,
      citizen_phone,
      reason,
      meeting_category,
      requested_meet_with_employee_id,
    } = data || {};

    const result = await pool.run(
      `INSERT INTO meeting_requests
       (created_by_employee_id, citizen_last_name, citizen_first_name, citizen_regno, citizen_gender, citizen_phone, reason, meeting_category, requested_meet_with_employee_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        createdByEmployeeId,
        citizen_last_name,
        citizen_first_name,
        citizen_regno,
        citizen_gender || null,
        citizen_phone || null,
        reason,
        meeting_category || null,
        requested_meet_with_employee_id,
      ]
    );

    const row = await pool.get('SELECT * FROM meeting_requests WHERE id = ?', [result.id]);
    return row;
  }

  static async getById(id) {
    return await pool.get('SELECT * FROM meeting_requests WHERE id = ?', [id]);
  }

  static async listForCreator(employeeId) {
    const result = await pool.query(
      `SELECT
        mr.*,
        e1.last_name || ' ' || e1.first_name AS created_by_name,
        e2.last_name || ' ' || e2.first_name AS meet_with_name
       FROM meeting_requests mr
       JOIN employees e1 ON e1.id = mr.created_by_employee_id
       JOIN employees e2 ON e2.id = mr.requested_meet_with_employee_id
       WHERE mr.created_by_employee_id = ?
       ORDER BY mr.id DESC`,
      [employeeId]
    );
    return result.rows || [];
  }

  static async listIncoming(employeeId) {
    const result = await pool.query(
      `SELECT
        mr.*,
        e1.last_name || ' ' || e1.first_name AS created_by_name,
        e2.last_name || ' ' || e2.first_name AS meet_with_name
       FROM meeting_requests mr
       JOIN employees e1 ON e1.id = mr.created_by_employee_id
       JOIN employees e2 ON e2.id = mr.requested_meet_with_employee_id
       WHERE mr.requested_meet_with_employee_id = ?
       ORDER BY mr.id DESC`,
      [employeeId]
    );
    return result.rows || [];
  }

  static async listAll() {
    const result = await pool.query(
      `SELECT
        mr.*,
        e1.last_name || ' ' || e1.first_name AS created_by_name,
        e2.last_name || ' ' || e2.first_name AS meet_with_name
       FROM meeting_requests mr
       JOIN employees e1 ON e1.id = mr.created_by_employee_id
       JOIN employees e2 ON e2.id = mr.requested_meet_with_employee_id
       ORDER BY mr.id DESC`
    );
    return result.rows || [];
  }

  static async approve(id, decidedBy, scheduledAt, scheduledDurationMinutes, note = null) {
    await pool.run(
      `UPDATE meeting_requests
       SET status = 'approved',
           scheduled_at = ?,
           scheduled_duration_minutes = ?,
           decision_note = ?,
           decided_by = ?,
           decided_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [scheduledAt, scheduledDurationMinutes, note, decidedBy, id]
    );
    return this.getById(id);
  }

  static async reject(id, decidedBy, note = null) {
    await pool.run(
      `UPDATE meeting_requests
       SET status = 'rejected',
           decision_note = ?,
           decided_by = ?,
           decided_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [note, decidedBy, id]
    );
    return this.getById(id);
  }

  static async complete(id, completedBy, actualDurationMinutes, completionNote = null) {
    await pool.run(
      `UPDATE meeting_requests
       SET status = 'completed',
           actual_duration_minutes = ?,
           completion_note = ?,
           completed_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [actualDurationMinutes, completionNote, id]
    );
    return this.getById(id);
  }
}

module.exports = MeetingRequest;
