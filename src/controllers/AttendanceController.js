const Attendance = require('../models/Attendance');
const attendanceStatsService = require('../services/attendanceStatsService');
const { isLeaderRole } = require('../utils/role');
const { distanceMeters } = require('../utils/geo');
const pool = require('../config/database');

const toNum = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

const isDutyOfficer = (position) => {
  const p = String(position || '').toLowerCase();
  return p.includes('жиж') || p.includes('duty');
};

const getWorkplaceConfig = async (employeeId) => {
  // Env override (optional)
  const envLat = process.env.WORKPLACE_LAT ? Number(process.env.WORKPLACE_LAT) : null;
  const envLng = process.env.WORKPLACE_LNG ? Number(process.env.WORKPLACE_LNG) : null;
  const envRadius = process.env.WORKPLACE_RADIUS_M ? Number(process.env.WORKPLACE_RADIUS_M) : null;
  if (Number.isFinite(envLat) && Number.isFinite(envLng)) {
    return {
      enabled: true,
      workplaceLat: envLat,
      workplaceLng: envLng,
      radiusM: Number.isFinite(envRadius) ? envRadius : 5,
    };
  }

  // Department workplace (per employee)
  try {
    const emp = await pool.get('SELECT department_id, department FROM employees WHERE id = ?', [employeeId]);
    const depId = emp?.department_id ? Number(emp.department_id) : null;
    const depName = String(emp?.department || '').trim();

    if (depId) {
      const dep = await pool.get(
        'SELECT lat, lng, radius_m FROM departments WHERE id = ? AND is_active = 1',
        [depId]
      );
      const dLat = toNum(dep?.lat);
      const dLng = toNum(dep?.lng);
      const dRadius = toNum(dep?.radius_m) || 5;
      if (dLat !== null && dLng !== null) {
        return { enabled: true, workplaceLat: dLat, workplaceLng: dLng, radiusM: dRadius };
      }
    }

    if (depName) {
      const dep = await pool.get(
        `SELECT lat, lng, radius_m
         FROM departments
         WHERE is_active = 1 AND (name = ? OR code = ? OR name LIKE ?)
         LIMIT 1`,
        [depName, depName, `%${depName}%`]
      );
      const dLat = toNum(dep?.lat);
      const dLng = toNum(dep?.lng);
      const dRadius = toNum(dep?.radius_m) || 5;
      if (dLat !== null && dLng !== null) {
        return { enabled: true, workplaceLat: dLat, workplaceLng: dLng, radiusM: dRadius };
      }
    }
  } catch {
    // ignore
  }

  // DB settings
  const rows = await pool.query(
    `SELECT key, value
     FROM app_settings
     WHERE key IN ('workplace_lat', 'workplace_lng', 'workplace_radius_m')`
  );
  const map = {};
  for (const r of rows.rows || []) map[r.key] = r.value;

  const workplaceLat = toNum(map.workplace_lat);
  const workplaceLng = toNum(map.workplace_lng);
  const radiusM = toNum(map.workplace_radius_m) || 5;
  const enabled = workplaceLat !== null && workplaceLng !== null;
  return { enabled, workplaceLat, workplaceLng, radiusM };
};

const isAssignedToTask = async (employeeId, taskId) => {
  const id = Number(taskId);
  if (!Number.isFinite(id) || id <= 0) return false;
  try {
    // New model: task_assignees table.
    const assignee = await pool.get(
      'SELECT 1 as ok FROM task_assignees WHERE task_id = ? AND employee_id = ? LIMIT 1',
      [id, employeeId]
    );
    if (assignee?.ok) return true;
  } catch {
    // ignore - table might not exist on very old DBs
  }

  try {
    // Legacy model: tasks.employee_id
    const row = await pool.get('SELECT 1 as ok FROM tasks WHERE id = ? AND employee_id = ? LIMIT 1', [
      id,
      employeeId,
    ]);
    return Boolean(row?.ok);
  } catch {
    return false;
  }
};

class AttendanceController {
  static async checkIn(req, res) {
    try {
      const employeeId = req.employee.id;
      const { enabled, workplaceLat, workplaceLng, radiusM } = await getWorkplaceConfig(employeeId);

      const body = req.body || {};
      const lat = body.lat;
      const lng = body.lng;
      const accuracy = body.accuracy;
      const managerTaskNo = String(body.manager_task_no || '').trim();

      if (managerTaskNo) {
        const ok = await isAssignedToTask(employeeId, managerTaskNo);
        if (!ok) {
          return res.status(403).json({
            message: 'Оруулсан үүргийн дугаар хүчинтэй биш эсвэл танд хамаарахгүй байна.',
          });
        }
      }

      if (enabled) {
        if (!Number.isFinite(Number(lat)) || !Number.isFinite(Number(lng))) {
          return res.status(400).json({
            message:
              'GPS байршлын мэдээлэл олдсонгүй. Байршлын зөвшөөрлөө асаагаад дахин оролдоно уу.',
          });
        }

        const dist = distanceMeters(
          { lat: Number(lat), lng: Number(lng) },
          { lat: workplaceLat, lng: workplaceLng }
        );
        const inOffice = dist !== null && dist <= radiusM;

        // Outside office: allow only if manager task number provided.
        if (!inOffice && !managerTaskNo) {
          return res.status(403).json({
            message: `Ирц бүртгэхийн тулд ажлын байрны ойролцоо (${radiusM} м дотор) ирнэ. Хэрэв гадуур ажлаар явж байгаа бол үүргийн дугаар оруулаад "Гадуур ажлаар бүртгүүлэх" товчийг дарна уу.`,
            distance_m: dist,
            required_radius_m: radiusM,
            accuracy_m: Number.isFinite(Number(accuracy)) ? Number(accuracy) : null,
          });
        }
      }

      const result = await Attendance.checkIn(employeeId, { manager_task_no: managerTaskNo });
      if (result?.error) {
        return res.status(400).json({ message: result.error });
      }

      return res.json({
        message: 'Ажилд ирэлт бүртгэгдлээ.',
        officeHours: { start: '08:30', end: '17:30' },
        data: result,
      });
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  static async checkOut(req, res) {
    try {
      const employeeId = req.employee.id;
      const result = await Attendance.checkOut(employeeId);

      if (!result) {
        return res.status(400).json({ message: 'Өнөөдрийн ирцийн бүртгэл олдсонгүй.' });
      }

      return res.json({
        message: 'Ажлаас гарсан цаг бүртгэгдлээ.',
        officeHours: { start: '08:30', end: '17:30' },
        data: result,
      });
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  static async getTodayAttendance(req, res) {
    try {
      const employeeId = req.employee.id;
      const result = await Attendance.getTodayByEmployee(employeeId);
      return res.json(result);
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  static async getAttendanceReport(req, res) {
    try {
      const selfId = Number(req.employee.id);
      const { startDate, endDate, employeeId } = req.query;

      if (isLeaderRole(req.employee.role) && (!employeeId || String(employeeId).toLowerCase() === 'all')) {
        const records = await Attendance.getAllDetailed(startDate, endDate);
        return res.json(records);
      }

      const requestedId = employeeId ? Number(employeeId) : selfId;
      const finalEmployeeId = isLeaderRole(req.employee.role) ? requestedId : selfId;

      const records = await Attendance.getByEmployee(finalEmployeeId, startDate, endDate);
      return res.json(records);
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  static async getAttendanceStats(req, res) {
    try {
      const employeeId = req.employee ? req.employee.id : null;
      const stats = attendanceStatsService.getAttendanceStats(employeeId);
      return res.json(stats);
    } catch {
      return res.status(500).json({ error: 'Attendance stats error' });
    }
  }

  static async getAllAttendance(req, res) {
    try {
      const { startDate, endDate } = req.query;
      const start = startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const end = endDate || new Date().toISOString().split('T')[0];
      const rows = await Attendance.getAllByDateRange(start, end);
      return res.json(rows);
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  static async updateOutsideWorkedHours(req, res) {
    try {
      const employeeId = req.employee.id;
      const { id } = req.params;
      const { outside_worked_hours, outside_work_location } = req.body;
      const value = Number(outside_worked_hours);
      const location = String(outside_work_location || '').trim();

      if (!Number.isFinite(value) || value < 0 || value > 24) {
        return res.status(400).json({ message: 'Гадуур ажилласан цаг 0-24 хооронд байна.' });
      }
      if (value > 0 && !location) {
        return res.status(400).json({ message: 'Гадуур явсан газраа заавал оруулна.' });
      }

      const row = await Attendance.updateOutsideWorkedHours(id, employeeId, value, location);
      if (row?.error) {
        return res.status(400).json({ message: row.error });
      }
      if (!row) {
        return res.status(404).json({ message: 'Ирцийн мөр олдсонгүй.' });
      }

      return res.json({ message: 'Гадуур ажилласан цаг шинэчлэгдлээ.', data: row });
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  static async startOutsideWork(req, res) {
    try {
      const employeeId = req.employee.id;
      const payload = req.body || {};
      const result = await Attendance.startOutsideWork(employeeId, payload);
      if (result?.error) {
        return res.status(400).json({ message: result.error });
      }
      return res.json({
        message: 'Гадуур ажил эхэллээ.',
        data: result,
      });
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  static async endOutsideWork(req, res) {
    try {
      const employeeId = req.employee.id;
      const result = await Attendance.endOutsideWork(employeeId);
      if (result?.error) {
        return res.status(400).json({ message: result.error });
      }
      return res.json({
        message: 'Гадуур ажил дууслаа.',
        data: result,
      });
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  static async getOutsideActive(req, res) {
    try {
      const isLeader = isLeaderRole(req.employee.role);
      const isDuty = isDutyOfficer(req.employee.position);
      const { date } = req.query;

      if (!isLeader && !isDuty) {
        return res.status(403).json({ message: 'Хандах эрхгүй байна.' });
      }

      const rows = await Attendance.getOutsideActive(date);
      return res.json(rows);
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  static async getOutsideLogs(req, res) {
    try {
      const employeeId = req.employee.id;
      const { date } = req.query;
      const rows = await Attendance.getOutsideLogsByEmployee(employeeId, date);
      return res.json(rows);
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }
}

module.exports = AttendanceController;
