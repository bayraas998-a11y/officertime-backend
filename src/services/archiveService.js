const pool = require('../config/database');

const toNum = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

class ArchiveService {
  static async archiveEmployee(employeeId, archivedBy = null) {
    const id = toNum(employeeId);
    if (!id) return { ok: false, status: 400, message: 'ID буруу байна.' };

    const employee = await pool.get('SELECT * FROM employees WHERE id = ?', [id]);
    if (!employee) return { ok: false, status: 404, message: 'Ажилтан олдсонгүй.' };

    // Archive employee row (snapshot).
    await pool.run(
      `INSERT INTO employee_archive (
        id, first_name, last_name, email, phone, position, department, department_id, age, rank, hire_date,
        is_active, approval_status, approved_by, approved_at, created_at, updated_at, archived_by, archived_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
      [
        employee.id,
        employee.first_name,
        employee.last_name,
        employee.email,
        employee.phone,
        employee.position,
        employee.department,
        employee.department_id,
        employee.age,
        employee.rank,
        employee.hire_date,
        employee.is_active,
        employee.approval_status,
        employee.approved_by,
        employee.approved_at,
        employee.created_at,
        employee.updated_at,
        archivedBy,
      ]
    );

    // Archive attendance rows (all).
    const att = await pool.query('SELECT * FROM attendance WHERE employee_id = ?', [id]);
    for (const a of att.rows || []) {
      await pool.run(
        `INSERT INTO attendance_archive (
          id, employee_id, check_in_time, check_out_time, date, hours_worked, notes, outside_worked_hours, outside_work_location,
          created_at, updated_at, archived_by, archived_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
        [
          a.id,
          a.employee_id,
          a.check_in_time,
          a.check_out_time,
          a.date,
          a.hours_worked,
          a.notes,
          a.outside_worked_hours,
          a.outside_work_location,
          a.created_at,
          a.updated_at,
          archivedBy,
        ]
      );
    }

    // Remove attendance data from main tables.
    await pool.run('DELETE FROM attendance WHERE employee_id = ?', [id]);

    // Disable login and anonymize sensitive fields.
    const archivedEmail = `archived_${id}_${Date.now()}@company.invalid`;
    await pool.run(
      `UPDATE employees
       SET is_active = 0,
           is_archived = 1,
           approval_status = 'rejected',
           email = ?,
           phone = NULL,
           password = 'archived',
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [archivedEmail, id]
    );

    return {
      ok: true,
      status: 200,
      message: 'Архивлалаа (ирцийн мэдээллийг үндсэн бүртгэлээс устгалаа).',
      archived_employee_id: id,
      archived_attendance_rows: (att.rows || []).length,
    };
  }

  static async listArchivedEmployees(limit = 200) {
    const lim = Math.min(1000, Math.max(1, Number(limit) || 200));
    const result = await pool.query(
      `SELECT
        id, first_name, last_name, email, position, department, department_id, rank, age,
        is_active, approval_status, archived_by, archived_at
       FROM employee_archive
       ORDER BY archived_at DESC
       LIMIT ?`,
      [lim]
    );
    return result.rows || [];
  }

  static async listArchivedAttendance(employeeId, limit = 500) {
    const id = toNum(employeeId);
    if (!id) return [];
    const lim = Math.min(5000, Math.max(1, Number(limit) || 500));
    const result = await pool.query(
      `SELECT
        id, employee_id, date, check_in_time, check_out_time, hours_worked, outside_worked_hours, outside_work_location,
        archived_by, archived_at
       FROM attendance_archive
       WHERE employee_id = ?
       ORDER BY date DESC
       LIMIT ?`,
      [id, lim]
    );
    return result.rows || [];
  }

  static async findAutoArchiveCandidates(years = 3, limit = 100) {
    const y = Math.min(20, Math.max(1, Number(years) || 3));
    const lim = Math.min(1000, Math.max(1, Number(limit) || 100));
    const result = await pool.query(
      `SELECT id
       FROM employees
       WHERE is_active = 0
         AND datetime(updated_at) <= datetime('now', ?)
       ORDER BY datetime(updated_at) ASC
       LIMIT ?`,
      [`-${y} years`, lim]
    );
    return (result.rows || []).map((r) => Number(r.id)).filter((v) => v > 0);
  }

  static async runAutoArchive({ years = 3, limit = 100 } = {}) {
    const ids = await this.findAutoArchiveCandidates(years, limit);
    const archived = [];
    const failed = [];

    for (const id of ids) {
      try {
        const res = await this.archiveEmployee(id, null);
        if (res.ok) archived.push({ id, archived_attendance_rows: res.archived_attendance_rows || 0 });
        else failed.push({ id, error: res.message || 'failed' });
      } catch (e) {
        failed.push({ id, error: e?.message || String(e) });
      }
    }

    return { years, candidates: ids.length, archived, failed };
  }
}

module.exports = ArchiveService;
