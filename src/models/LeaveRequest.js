const pool = require('../config/database');

const statusLabelMap = {
  pending: 'Хүлээгдэж буй',
  approved: 'Зөвшөөрсөн',
  rejected: 'Татгалзсан',
};

const withStatusLabel = (row) => {
  if (!row) return row;
  return {
    ...row,
    status_label: statusLabelMap[row.status] || row.status,
  };
};

let tableReady = false;
const ensureTable = async () => {
  if (tableReady) return;
  await pool.run(
    `CREATE TABLE IF NOT EXISTS leave_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id INTEGER NOT NULL,
      leave_date DATE NOT NULL,
      leave_type TEXT NOT NULL CHECK(leave_type IN ('full_day', 'half_day')),
      reason TEXT NOT NULL,
      proof_image TEXT,
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'approved', 'rejected')),
      manager_note TEXT,
      reviewed_by INTEGER,
      reviewed_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`
  );
  tableReady = true;
};

class LeaveRequest {
  static async create(employeeId, data) {
    await ensureTable();
    const { leave_date, leave_type, reason, proof_image } = data;
    const result = await pool.run(
      `INSERT INTO leave_requests (employee_id, leave_date, leave_type, reason, proof_image)
       VALUES (?, ?, ?, ?, ?)`,
      [employeeId, leave_date, leave_type, reason, proof_image || null]
    );
    const row = await pool.query(
      `SELECT lr.*, e.first_name || ' ' || e.last_name as employee_name
       FROM leave_requests lr
       JOIN employees e ON e.id = lr.employee_id
       WHERE lr.id = ?`,
      [result.id]
    );
    return withStatusLabel(row.rows[0]);
  }

  static async getByEmployee(employeeId) {
    await ensureTable();
    const result = await pool.query(
      `SELECT *
       FROM leave_requests
       WHERE employee_id = ?
       ORDER BY created_at DESC`,
      [employeeId]
    );
    return result.rows.map(withStatusLabel);
  }

  static async getAll() {
    await ensureTable();
    const result = await pool.query(
      `SELECT lr.*, e.first_name || ' ' || e.last_name as employee_name
       FROM leave_requests lr
       JOIN employees e ON e.id = lr.employee_id
       ORDER BY CASE lr.status WHEN 'pending' THEN 0 WHEN 'approved' THEN 1 ELSE 2 END, lr.created_at DESC`
    );
    return result.rows.map(withStatusLabel);
  }

  static async review(id, reviewerId, status, managerNote) {
    await ensureTable();
    await pool.run(
      `UPDATE leave_requests
       SET status = ?, manager_note = ?, reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [status, managerNote || null, reviewerId, id]
    );
    const result = await pool.query(
      `SELECT lr.*, e.first_name || ' ' || e.last_name as employee_name
       FROM leave_requests lr
       JOIN employees e ON e.id = lr.employee_id
       WHERE lr.id = ?`,
      [id]
    );
    return withStatusLabel(result.rows[0]);
  }

  static async reschedule(id, reviewerId, newLeaveDate, managerNote) {
    await ensureTable();
    await pool.run(
      `UPDATE leave_requests
       SET leave_date = ?, status = 'pending', manager_note = ?, reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [newLeaveDate, managerNote || null, reviewerId, id]
    );
    const result = await pool.query(
      `SELECT lr.*, e.first_name || ' ' || e.last_name as employee_name
       FROM leave_requests lr
       JOIN employees e ON e.id = lr.employee_id
       WHERE lr.id = ?`,
      [id]
    );
    return withStatusLabel(result.rows[0]);
  }
}

module.exports = LeaveRequest;

