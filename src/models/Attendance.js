const pool = require('../config/database');

const ULAANBAATAR_OFFSET_HOURS = 8;

const getUlaanbaatarNow = () => {
  const now = new Date();
  const utcMs = now.getTime() + now.getTimezoneOffset() * 60 * 1000;
  return new Date(utcMs + ULAANBAATAR_OFFSET_HOURS * 60 * 60 * 1000);
};

const toSqlDate = (date) => date.toISOString().split('T')[0];

// Store timestamps as ISO UTC (with Z).
const toUtcIso = (date) => date.toISOString();

const isApprovedLeave = async (employeeId, dateStr) => {
  if (!employeeId || !dateStr) return null;
  try {
    const row = await pool.get(
      `SELECT leave_type
       FROM leave_requests
       WHERE employee_id = ? AND leave_date = ? AND status = 'approved'
       LIMIT 1`,
      [employeeId, dateStr]
    );
    return row || null;
  } catch {
    // leave_requests table may not exist on some fresh DBs.
    return null;
  }
};

const getApprovedLeavesByEmployee = async (employeeId, startDate, endDate) => {
  if (!employeeId || !startDate || !endDate) return [];
  try {
    const result = await pool.query(
      `SELECT leave_date, leave_type
       FROM leave_requests
       WHERE employee_id = ?
         AND leave_date BETWEEN ? AND ?
         AND status = 'approved'
       ORDER BY leave_date`,
      [employeeId, startDate, endDate]
    );
    return result.rows || [];
  } catch {
    return [];
  }
};

const parseDbTimestamp = (value) => {
  if (!value) return null;
  const raw = String(value).trim();
  if (!raw) return null;

  // ISO with timezone (Z / +08:00 / etc)
  if (raw.endsWith('Z') || raw.includes('+') || (raw.includes('T') && raw.length > 19)) {
    const d = new Date(raw);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  // Legacy "YYYY-MM-DD HH:mm:ss" (no timezone) -> treat as UTC (SQLite CURRENT_TIMESTAMP is UTC).
  const normalized = raw.replace(' ', 'T');
  const legacyUtc = new Date(normalized.endsWith('Z') ? normalized : `${normalized}Z`);
  return Number.isNaN(legacyUtc.getTime()) ? null : legacyUtc;
};

const calculateAttendanceFlags = (record) => {
  if (!record) return null;

  const outsideWorkedHours = Number(record.outside_worked_hours || 0);
  const workedHours = Number(record.hours_worked || 0);
  const result = {
    ...record,
    late_minutes: 0,
    overtime_minutes: 0,
    attendance_flag: '',
    outside_worked_hours: outsideWorkedHours,
    total_worked_hours: workedHours + outsideWorkedHours,
  };

  if (!record.check_in_time) return result;

  const dateStr = String(record.date).slice(0, 10);
  const checkIn = parseDbTimestamp(record.check_in_time);
  if (!checkIn || !dateStr) return result;

  // Office hours are in Ulaanbaatar time (UTC+8). Convert to UTC for consistent math:
  // 08:30 (+8) -> 00:30Z, 17:30 (+8) -> 09:30Z.
  const start = new Date(`${dateStr}T00:30:00Z`);
  const end = new Date(`${dateStr}T09:30:00Z`);

  const lateMinutes = Math.max(0, Math.round((checkIn.getTime() - start.getTime()) / 60000));
  result.late_minutes = lateMinutes;

  if (record.check_out_time) {
    const checkOut = parseDbTimestamp(record.check_out_time);
    if (checkOut) {
      result.overtime_minutes = Math.max(0, Math.round((checkOut.getTime() - end.getTime()) / 60000));
    }
  }

  if (lateMinutes > 0 && result.overtime_minutes > 0) {
    result.attendance_flag = 'Хоцорсон, илүү цагтай';
  } else if (lateMinutes > 0) {
    result.attendance_flag = 'Хоцорсон';
  } else if (result.overtime_minutes > 0) {
    result.attendance_flag = 'Илүү цагтай';
  } else {
    result.attendance_flag = 'Хэвийн';
  }

  return result;
};

const computeOutsideHours = async (attendanceId) => {
  const row = await pool.get(
    `SELECT COALESCE(SUM((julianday(end_time) - julianday(start_time)) * 24.0), 0) as hours
     FROM outside_work_logs
     WHERE attendance_id = ? AND end_time IS NOT NULL`,
    [attendanceId]
  );
  return Number(row?.hours || 0);
};

class Attendance {
  static async getByEmployee(employeeId, startDate, endDate) {
    const result = await pool.query(
      `SELECT
        a.*,
        e.department,
        e.position,
        e.first_name,
        e.last_name,
        COALESCE(a.outside_worked_hours, 0) as outside_worked_hours,
        COALESCE(a.hours_worked, 0) + COALESCE(a.outside_worked_hours, 0) as total_worked_hours
      FROM attendance a
      JOIN employees e ON e.id = a.employee_id
      WHERE a.employee_id = ? AND a.date BETWEEN ? AND ?
      ORDER BY a.date DESC`,
      [employeeId, startDate, endDate]
    );

    const computed = (result.rows || []).map(calculateAttendanceFlags);
    const leaves = await getApprovedLeavesByEmployee(employeeId, startDate, endDate);
    if (!leaves.length) return computed;

    const existingDates = new Set(computed.map((r) => String(r.date).slice(0, 10)));
    const sample = computed[0] || {};

    for (const lr of leaves) {
      const dateStr = String(lr.leave_date).slice(0, 10);
      if (existingDates.has(dateStr)) continue;
      computed.push({
        id: null,
        employee_id: employeeId,
        date: dateStr,
        check_in_time: null,
        check_out_time: null,
        outside_start_time: null,
        outside_end_time: null,
        hours_worked: 0,
        outside_worked_hours: 0,
        outside_work_location: null,
        outside_work_reason: null,
        outside_work_types: null,
        department: sample.department || null,
        position: sample.position || null,
        first_name: sample.first_name || null,
        last_name: sample.last_name || null,
        late_minutes: 0,
        overtime_minutes: 0,
        attendance_flag: 'Чөлөөтэй',
        total_worked_hours: 0,
        is_on_leave: true,
        leave_type: lr.leave_type,
      });
    }

    computed.sort((a, b) => String(b.date).localeCompare(String(a.date)));
    return computed;
  }

  static async getAllDetailed(startDate, endDate) {
    const result = await pool.query(
      `SELECT
        a.*,
        e.department,
        e.position,
        e.first_name,
        e.last_name,
        COALESCE(a.outside_worked_hours, 0) as outside_worked_hours,
        COALESCE(a.hours_worked, 0) + COALESCE(a.outside_worked_hours, 0) as total_worked_hours
      FROM attendance a
      JOIN employees e ON e.id = a.employee_id
      WHERE a.date BETWEEN ? AND ?
      ORDER BY a.date DESC, e.last_name ASC, e.first_name ASC`,
      [startDate, endDate]
    );

    const computed = (result.rows || []).map(calculateAttendanceFlags);

    // Add approved leave days as synthetic rows (only when there's no attendance row for that employee/date).
    let leaveRows = [];
    try {
      const lr = await pool.query(
        `SELECT
          lr.employee_id,
          lr.leave_date,
          lr.leave_type,
          e.department,
          e.position,
          e.first_name,
          e.last_name
        FROM leave_requests lr
        JOIN employees e ON e.id = lr.employee_id
        WHERE lr.status = 'approved' AND lr.leave_date BETWEEN ? AND ?`,
        [startDate, endDate]
      );
      leaveRows = lr.rows || [];
    } catch {
      leaveRows = [];
    }

    if (!leaveRows.length) return computed;

    const existing = new Set(
      computed.map((r) => `${r.employee_id}|${String(r.date).slice(0, 10)}`)
    );

    for (const lr of leaveRows) {
      const dateStr = String(lr.leave_date).slice(0, 10);
      const key = `${lr.employee_id}|${dateStr}`;
      if (existing.has(key)) continue;
      computed.push({
        id: null,
        employee_id: lr.employee_id,
        date: dateStr,
        check_in_time: null,
        check_out_time: null,
        outside_start_time: null,
        outside_end_time: null,
        hours_worked: 0,
        outside_worked_hours: 0,
        outside_work_location: null,
        outside_work_reason: null,
        outside_work_types: null,
        department: lr.department || null,
        position: lr.position || null,
        first_name: lr.first_name || null,
        last_name: lr.last_name || null,
        late_minutes: 0,
        overtime_minutes: 0,
        attendance_flag: 'Чөлөөтэй',
        total_worked_hours: 0,
        is_on_leave: true,
        leave_type: lr.leave_type,
      });
    }

    computed.sort((a, b) => {
      const d = String(b.date).localeCompare(String(a.date));
      if (d !== 0) return d;
      const ln = String(a.last_name || '').localeCompare(String(b.last_name || ''), 'mn');
      if (ln !== 0) return ln;
      return String(a.first_name || '').localeCompare(String(b.first_name || ''), 'mn');
    });

    return computed;
  }

  static async getTodayByEmployee(employeeId) {
    const today = toSqlDate(getUlaanbaatarNow());
    const leave = await isApprovedLeave(employeeId, today);
    const result = await pool.query(
      'SELECT * FROM attendance WHERE employee_id = ? AND date = ?',
      [employeeId, today]
    );
    const row = result.rows[0];
    if (!row && leave) {
      return {
        id: null,
        employee_id: employeeId,
        date: today,
        check_in_time: null,
        check_out_time: null,
        outside_start_time: null,
        outside_end_time: null,
        hours_worked: 0,
        outside_worked_hours: 0,
        outside_work_location: null,
        outside_work_reason: null,
        outside_work_types: null,
        late_minutes: 0,
        overtime_minutes: 0,
        attendance_flag: 'Чөлөөтэй',
        total_worked_hours: 0,
        is_on_leave: true,
        leave_type: leave.leave_type,
      };
    }

    const computed = calculateAttendanceFlags(row);
    if (leave && computed && !computed.check_in_time && !computed.check_out_time) {
      return {
        ...computed,
        is_on_leave: true,
        leave_type: leave.leave_type,
        attendance_flag: 'Чөлөөтэй',
        late_minutes: 0,
        overtime_minutes: 0,
      };
    }
    return computed;
  }

  static async checkIn(employeeId, options = {}) {
    const nowUtc = new Date();
    const today = toSqlDate(getUlaanbaatarNow());
    const nowSql = toUtcIso(nowUtc);

    const leave = await isApprovedLeave(employeeId, today);
    if (leave) {
      return { error: 'Өнөөдөр чөлөөтэй тул ирц бүртгэх боломжгүй.' };
    }

    const existingRecord = await pool.query(
      'SELECT * FROM attendance WHERE employee_id = ? AND date = ?',
      [employeeId, today]
    );

    if (existingRecord.rows.length > 0) {
      return { error: 'Өнөөдөр ирц аль хэдийн бүртгэгдсэн байна.' };
    }

    const managerTaskNo = String(options.manager_task_no || '').trim();
    const outsideWorkTag = managerTaskNo ? `Гадуур ажил (үүрэг №${managerTaskNo})` : null;

    const insertResult = await pool.run(
      'INSERT INTO attendance (employee_id, check_in_time, date, outside_work_location) VALUES (?, ?, ?, ?)',
      [employeeId, nowSql, today, outsideWorkTag]
    );

    const result = await pool.query('SELECT * FROM attendance WHERE id = ?', [insertResult.id]);
    return calculateAttendanceFlags(result.rows[0]);
  }

  static async checkOut(employeeId) {
    const nowUtc = new Date();
    const today = toSqlDate(getUlaanbaatarNow());
    const nowSql = toUtcIso(nowUtc);

    const current = await pool.query(
      'SELECT * FROM attendance WHERE employee_id = ? AND date = ?',
      [employeeId, today]
    );
    const row = current.rows[0];
    if (!row) return null;

    const checkIn = parseDbTimestamp(row.check_in_time);
    const workedHours = checkIn
      ? Math.max(0, (nowUtc.getTime() - checkIn.getTime()) / (1000 * 60 * 60))
      : 0;

    await pool.run(
      'UPDATE attendance SET check_out_time = ?, hours_worked = ?, updated_at = CURRENT_TIMESTAMP WHERE employee_id = ? AND date = ?',
      [nowSql, workedHours, employeeId, today]
    );

    const result = await pool.query(
      'SELECT * FROM attendance WHERE employee_id = ? AND date = ?',
      [employeeId, today]
    );
    return calculateAttendanceFlags(result.rows[0]);
  }

  static async getAllByDateRange(startDate, endDate) {
    const result = await pool.query(
      `SELECT
        a.employee_id,
        e.first_name || ' ' || e.last_name as employee_name,
        COALESCE(SUM(a.hours_worked), 0) as hours_worked
      FROM attendance a
      JOIN employees e ON e.id = a.employee_id
      WHERE a.date BETWEEN ? AND ?
      GROUP BY a.employee_id, employee_name
      ORDER BY hours_worked DESC`,
      [startDate, endDate]
    );
    return result.rows;
  }

  static async updateOutsideWorkedHours(attendanceId, employeeId, outsideWorkedHours, outsideWorkLocation) {
    // One-time rule: only allow if not already submitted.
    const existing = await pool.get(
      'SELECT outside_worked_hours, outside_work_location FROM attendance WHERE id = ? AND employee_id = ?',
      [attendanceId, employeeId]
    );
    if (!existing) return null;
    const already = Number(existing.outside_worked_hours || 0) > 0;
    if (already) {
      return { error: 'Өнөөдрийн гадуур ажилласан цаг аль хэдийн бүртгэгдсэн байна.' };
    }

    await pool.run(
      `UPDATE attendance
       SET outside_worked_hours = ?, outside_work_location = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND employee_id = ?`,
      [outsideWorkedHours, outsideWorkLocation || null, attendanceId, employeeId]
    );

    const result = await pool.query(
      `SELECT
        a.*,
        e.department,
        e.position,
        e.first_name,
        e.last_name,
        COALESCE(a.outside_worked_hours, 0) as outside_worked_hours,
        COALESCE(a.hours_worked, 0) + COALESCE(a.outside_worked_hours, 0) as total_worked_hours
      FROM attendance a
      JOIN employees e ON e.id = a.employee_id
      WHERE a.id = ? AND a.employee_id = ?`,
      [attendanceId, employeeId]
    );

    return calculateAttendanceFlags(result.rows[0] || null);
  }

  static async startOutsideWork(employeeId, payload = {}) {
    const nowUtc = new Date();
    const today = toSqlDate(getUlaanbaatarNow());
    const nowSql = toUtcIso(nowUtc);
    const location = String(payload.outside_work_location || '').trim();
    const reason = String(payload.outside_work_reason || '').trim();
    const types = payload.outside_work_types ? JSON.stringify(payload.outside_work_types) : null;

    const existing = await pool.get(
      'SELECT * FROM attendance WHERE employee_id = ? AND date = ?',
      [employeeId, today]
    );

    if (!existing || !existing.check_in_time) {
      return { error: 'Эхлээд өнөөдрийн ирцээ бүртгэнэ үү.' };
    }

    const active = await pool.get(
      `SELECT id FROM outside_work_logs
       WHERE employee_id = ? AND date = ? AND end_time IS NULL
       ORDER BY start_time DESC LIMIT 1`,
      [employeeId, today]
    );
    if (active?.id) {
      return { error: 'Гадуур ажил аль хэдийн эхэлсэн байна.' };
    }

    await pool.run(
      `INSERT INTO outside_work_logs (attendance_id, employee_id, date, start_time, location, reason, types)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [existing.id, employeeId, today, nowSql, location, reason, types]
    );

    await pool.run(
      `UPDATE attendance
       SET outside_start_time = ?, outside_end_time = NULL, outside_work_location = ?, outside_work_reason = ?, outside_work_types = ?, updated_at = CURRENT_TIMESTAMP
       WHERE employee_id = ? AND date = ?`,
      [nowSql, location, reason, types, employeeId, today]
    );

    const totalOutside = await computeOutsideHours(existing.id);
    await pool.run(
      `UPDATE attendance
       SET outside_worked_hours = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [totalOutside, existing.id]
    );

    const result = await pool.get(
      `SELECT
        a.*,
        e.department,
        e.position,
        e.first_name,
        e.last_name,
        COALESCE(a.outside_worked_hours, 0) as outside_worked_hours,
        COALESCE(a.hours_worked, 0) + COALESCE(a.outside_worked_hours, 0) as total_worked_hours
      FROM attendance a
      JOIN employees e ON e.id = a.employee_id
      WHERE a.employee_id = ? AND a.date = ?`,
      [employeeId, today]
    );
    return calculateAttendanceFlags(result || null);
  }

  static async endOutsideWork(employeeId) {
    const nowUtc = new Date();
    const today = toSqlDate(getUlaanbaatarNow());
    const nowSql = toUtcIso(nowUtc);

    const current = await pool.get(
      'SELECT * FROM attendance WHERE employee_id = ? AND date = ?',
      [employeeId, today]
    );
    if (!current) {
      return { error: 'Өнөөдрийн ирц олдсонгүй.' };
    }

    const active = await pool.get(
      `SELECT * FROM outside_work_logs
       WHERE employee_id = ? AND date = ? AND end_time IS NULL
       ORDER BY start_time DESC LIMIT 1`,
      [employeeId, today]
    );
    if (!active) {
      return { error: 'Гадуур ажил эхлээгүй байна.' };
    }

    await pool.run(
      `UPDATE outside_work_logs
       SET end_time = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [nowSql, active.id]
    );

    const totalOutside = await computeOutsideHours(current.id);
    await pool.run(
      `UPDATE attendance
       SET outside_end_time = ?, outside_worked_hours = ?, updated_at = CURRENT_TIMESTAMP
       WHERE employee_id = ? AND date = ?`,
      [nowSql, totalOutside, employeeId, today]
    );

    const result = await pool.get(
      `SELECT
        a.*,
        e.department,
        e.position,
        e.first_name,
        e.last_name,
        COALESCE(a.outside_worked_hours, 0) as outside_worked_hours,
        COALESCE(a.hours_worked, 0) + COALESCE(a.outside_worked_hours, 0) as total_worked_hours
      FROM attendance a
      JOIN employees e ON e.id = a.employee_id
      WHERE a.employee_id = ? AND a.date = ?`,
      [employeeId, today]
    );
    return calculateAttendanceFlags(result || null);
  }

  static async getOutsideActive(dateStr) {
    const date = dateStr || toSqlDate(getUlaanbaatarNow());
    const result = await pool.query(
      `SELECT
        ow.id as id,
        a.id as attendance_id,
        a.employee_id,
        a.date,
        a.check_in_time,
        a.check_out_time,
        a.hours_worked,
        a.outside_worked_hours,
        a.outside_start_time,
        a.outside_end_time,
        a.outside_work_location,
        a.outside_work_reason,
        a.outside_work_types,
        e.department,
        e.position,
        e.first_name,
        e.last_name,
        ow.start_time as outside_start_time,
        ow.end_time as outside_end_time,
        ow.location as outside_work_location,
        ow.reason as outside_work_reason,
        ow.types as outside_work_types
      FROM outside_work_logs ow
      JOIN attendance a ON a.id = ow.attendance_id
      JOIN employees e ON e.id = ow.employee_id
      WHERE ow.date = ? AND ow.end_time IS NULL
      ORDER BY ow.start_time ASC`,
      [date]
    );
    return (result.rows || []).map(calculateAttendanceFlags);
  }

  static async getOutsideLogsByEmployee(employeeId, dateStr) {
    const date = dateStr || toSqlDate(getUlaanbaatarNow());
    const result = await pool.query(
      `SELECT
        ow.id,
        ow.attendance_id,
        ow.employee_id,
        ow.date,
        ow.start_time,
        ow.end_time,
        ow.location,
        ow.reason,
        ow.types,
        ow.created_at,
        ow.updated_at
      FROM outside_work_logs ow
      WHERE ow.employee_id = ? AND ow.date = ?
      ORDER BY ow.start_time ASC`,
      [employeeId, date]
    );
    return result.rows || [];
  }
}

module.exports = Attendance;
