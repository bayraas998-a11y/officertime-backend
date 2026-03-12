const pool = require('../config/database');

const CATEGORY_ORDER = ['Иргэн', 'Прокурор', 'Шүүх', 'Шүүх эмнэлэг', 'Сургалт', 'Хурал', 'Бусад'];

// SQLite: %w -> 0=Sunday ... 6=Saturday
const DOW_TO_MN = {
  0: 'Ням',
  1: 'Даваа',
  2: 'Мягмар',
  3: 'Лхагва',
  4: 'Пүрэв',
  5: 'Баасан',
  6: 'Бямба',
};

const WEEK_ORDER = ['Даваа', 'Мягмар', 'Лхагва', 'Пүрэв', 'Баасан', 'Бямба', 'Ням'];

async function getTotals(employeeId, days) {
  const row = await pool.get(
    `SELECT
       COUNT(*) AS total,
       COALESCE(SUM(COALESCE(actual_duration_minutes, 0)), 0) AS minutes
     FROM meeting_requests
     WHERE status = 'completed'
       AND completed_at IS NOT NULL
       AND completed_at >= datetime('now', 'localtime', ?)
       AND (created_by_employee_id = ? OR requested_meet_with_employee_id = ?)`,
    [`-${Number(days)} days`, employeeId, employeeId]
  );
  return {
    total: Number(row?.total || 0),
    minutes: Number(row?.minutes || 0),
  };
}

async function getMeetingStats(employeeId) {
  if (!employeeId) {
    return {
      totalMeetings: 0,
      totalMinutes: 0,
      week: WEEK_ORDER.map((name) => ({ name, minutes: 0 })),
      categories: CATEGORY_ORDER.map((name) => ({ name, minutes: 0 })),
      month: { total: 0, minutes: 0 },
      year: { total: 0, minutes: 0 },
    };
  }

  const month = await getTotals(employeeId, 30);
  const year = await getTotals(employeeId, 365);

  const weekRows = await pool.query(
    `SELECT
       CAST(strftime('%w', completed_at, 'localtime') AS INTEGER) AS dow,
       COALESCE(SUM(COALESCE(actual_duration_minutes, 0)), 0) AS minutes
     FROM meeting_requests
     WHERE status = 'completed'
       AND completed_at IS NOT NULL
       AND completed_at >= datetime('now', 'localtime', '-6 days')
       AND (created_by_employee_id = ? OR requested_meet_with_employee_id = ?)
     GROUP BY dow`,
    [employeeId, employeeId]
  );

  const weekMap = new Map();
  for (const r of weekRows.rows || []) {
    const name = DOW_TO_MN[Number(r.dow)];
    if (!name) continue;
    weekMap.set(name, Number(r.minutes || 0));
  }
  const week = WEEK_ORDER.map((name) => ({ name, minutes: weekMap.get(name) || 0 }));

  const catRows = await pool.query(
    `SELECT
       COALESCE(NULLIF(TRIM(meeting_category), ''), 'Бусад') AS category,
       COALESCE(SUM(COALESCE(actual_duration_minutes, 0)), 0) AS minutes
     FROM meeting_requests
     WHERE status = 'completed'
       AND completed_at IS NOT NULL
       AND completed_at >= datetime('now', 'localtime', '-30 days')
       AND (created_by_employee_id = ? OR requested_meet_with_employee_id = ?)
     GROUP BY category`,
    [employeeId, employeeId]
  );

  const catMap = new Map();
  for (const r of catRows.rows || []) {
    const key = String(r.category || 'Бусад');
    catMap.set(key, Number(r.minutes || 0));
  }

  const categories = CATEGORY_ORDER.map((name) => ({ name, minutes: catMap.get(name) || 0 }));

  return {
    totalMeetings: month.total,
    totalMinutes: month.minutes,
    week,
    categories,
    month,
    year,
  };
}

module.exports = { getMeetingStats };
