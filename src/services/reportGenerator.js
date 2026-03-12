const XLSX = require('xlsx');
const PDFDocument = require('pdfkit');
const pool = require('../config/database');
const fs = require('fs');
const path = require('path');

const ULAANBAATAR_OFFSET_MS = 8 * 60 * 60 * 1000;

const pad2 = (n) => String(n).padStart(2, '0');

const parseDbTimestampUtc = (value) => {
  if (!value) return null;
  const raw = String(value).trim();
  if (!raw) return null;

  // ISO with timezone.
  if (raw.endsWith('Z') || raw.includes('+') || (raw.includes('T') && raw.length > 19)) {
    const d = new Date(raw);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  // Legacy "YYYY-MM-DD HH:mm:ss" (no timezone) -> treat as UTC.
  const normalized = raw.replace(' ', 'T');
  const legacyUtc = new Date(normalized.endsWith('Z') ? normalized : `${normalized}Z`);
  return Number.isNaN(legacyUtc.getTime()) ? null : legacyUtc;
};

// Avoid relying on Intl timeZone support; compute Ulaanbaatar time manually (UTC+8).
const formatUlaanTime = (value) => {
  const d = parseDbTimestampUtc(value);
  if (!d) return '-';
  const shifted = new Date(d.getTime() + ULAANBAATAR_OFFSET_MS);
  return `${pad2(shifted.getUTCHours())}:${pad2(shifted.getUTCMinutes())}`;
};

const formatUlaanDate = (value) => {
  if (!value) return '-';
  const dateStr = String(value).slice(0, 10);
  const d = new Date(`${dateStr}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return dateStr;
  const shifted = new Date(d.getTime() + ULAANBAATAR_OFFSET_MS);
  return `${shifted.getUTCFullYear()}.${pad2(shifted.getUTCMonth() + 1)}.${pad2(shifted.getUTCDate())}`;
};

const pickFontPath = (candidates) => {
  for (const p of candidates) {
    try {
      if (p && fs.existsSync(p)) return p;
    } catch (_) {
      // ignore
    }
  }
  return null;
};

const getPdfFonts = () => {
  const winDir = process.env.WINDIR || 'C:\\Windows';
  const regularCandidates = [
    path.join(__dirname, '../../assets/fonts/NotoSans-Regular.ttf'),
    path.join(__dirname, '../../assets/fonts/DejaVuSans.ttf'),
    path.join(winDir, 'Fonts', 'segoeui.ttf'),
    path.join(winDir, 'Fonts', 'arial.ttf'),
  ];
  const boldCandidates = [
    path.join(__dirname, '../../assets/fonts/NotoSans-Bold.ttf'),
    path.join(__dirname, '../../assets/fonts/DejaVuSans-Bold.ttf'),
    path.join(winDir, 'Fonts', 'segoeuib.ttf'),
    path.join(winDir, 'Fonts', 'arialbd.ttf'),
  ];
  return {
    regular: pickFontPath(regularCandidates),
    bold: pickFontPath(boldCandidates),
  };
};

const mergeAttendanceWithLeave = (attendanceRows, approvedLeaveRows, startDate, endDate) => {
  const attendanceByDate = new Map();
  for (const r of attendanceRows || []) attendanceByDate.set(String(r.date).slice(0, 10), r);

  const leaveByDate = new Map();
  for (const lr of approvedLeaveRows || []) leaveByDate.set(String(lr.leave_date).slice(0, 10), lr);

  const out = [];
  const cur = new Date(`${String(startDate).slice(0, 10)}T00:00:00Z`);
  const end = new Date(`${String(endDate).slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(cur.getTime()) || Number.isNaN(end.getTime())) return attendanceRows || [];

  for (let d = cur; d.getTime() <= end.getTime(); d = new Date(d.getTime() + 24 * 60 * 60 * 1000)) {
    const dateStr = d.toISOString().slice(0, 10);
    const a = attendanceByDate.get(dateStr);
    if (a) {
      out.push(a);
      continue;
    }
    const leave = leaveByDate.get(dateStr);
    if (leave) {
      out.push({
        date: dateStr,
        check_in_time: null,
        check_out_time: null,
        hours_worked: 0,
        outside_worked_hours: 0,
        outside_work_location: null,
        attendance_flag: `Чөлөөтэй (${leave.leave_type === 'half_day' ? 'Хагас өдөр' : '1 өдөр'})`,
      });
    }
  }

  // Keep chronological order.
  return out.sort((a, b) => String(a.date).localeCompare(String(b.date)));
};

class ReportGenerator {
  static async generateExcelReport(employeeId, startDate, endDate, res) {
    try {
      const workbook = XLSX.utils.book_new();

      const empData = await pool.query(
        'SELECT first_name, last_name, position, department FROM employees WHERE id = ?',
        [employeeId]
      );
      const emp = empData.rows?.[0] || {};
      const fullName = [emp.last_name, emp.first_name].filter(Boolean).join(' ') || '-';

      const attendanceData = await pool.query(
        'SELECT date, check_in_time, check_out_time, hours_worked, outside_worked_hours, outside_work_location FROM attendance WHERE employee_id = ? AND date BETWEEN ? AND ? ORDER BY date',
        [employeeId, startDate, endDate]
      );
      const leaveData = await pool.query(
        "SELECT leave_date, leave_type FROM leave_requests WHERE employee_id = ? AND leave_date BETWEEN ? AND ? AND status = 'approved' ORDER BY leave_date",
        [employeeId, startDate, endDate]
      );

      const mergedAttendance = mergeAttendanceWithLeave(
        attendanceData.rows || [],
        leaveData.rows || [],
        startDate,
        endDate
      );

      const attendanceSheet = XLSX.utils.json_to_sheet(
        mergedAttendance.map((row) => {
          const baseHours = Number(row.hours_worked || 0);
          const outside = Number(row.outside_worked_hours || 0);
          const total = baseHours + outside;
          return {
            'Овог, нэр': fullName,
            Тасаг: emp.department || '-',
            'Албан тушаал': emp.position || '-',
            Огноо: formatUlaanDate(row.date),
            'Ирэх цаг': formatUlaanTime(row.check_in_time),
            'Гарах цаг': formatUlaanTime(row.check_out_time),
            'Гадуур ажилласан цаг': outside.toFixed(2),
            'Гадуур явсан газар': row.outside_work_location || '-',
            'Нийт ажилласан цаг': total.toFixed(2),
            Төлөв: row.attendance_flag || (row.check_in_time ? 'Бүртгэгдсэн' : '-'),
          };
        })
      );
      XLSX.utils.book_append_sheet(workbook, attendanceSheet, 'Ирц');

      const tasksData = await pool.query(
        'SELECT title, status, priority, completion_percentage, due_date FROM tasks WHERE employee_id = ? AND created_at BETWEEN ? AND ?',
        [employeeId, startDate, endDate]
      );

      const tasksSheet = XLSX.utils.json_to_sheet(
        (tasksData.rows || []).map((row) => ({
          'Даалгаврын нэр': row.title,
          Төлөв: row.status,
          Төрөл: row.priority,
          'Гүйцэтгэл %': row.completion_percentage,
          'Дуусах огноо': row.due_date ? formatUlaanDate(row.due_date) : '-',
        }))
      );
      XLSX.utils.book_append_sheet(workbook, tasksSheet, 'Даалгавар');

      const summarySql = `SELECT 
        (SELECT COUNT(*) FROM attendance WHERE employee_id = ? AND date BETWEEN ? AND ?) as total_days,
        (SELECT AVG(hours_worked) FROM attendance WHERE employee_id = ? AND date BETWEEN ? AND ?) as avg_hours,
        (SELECT COUNT(*) FROM tasks WHERE employee_id = ? AND status = 'completed' AND created_at BETWEEN ? AND ?) as completed_tasks,
        (SELECT COUNT(*) FROM meetings WHERE employee_id = ? AND meeting_date BETWEEN ? AND ?) as total_meetings`;
      const summary = await pool.query(summarySql, [
        employeeId, startDate, endDate,
        employeeId, startDate, endDate,
        employeeId, startDate, endDate,
        employeeId, startDate, endDate,
      ]);

      const summarySheet = XLSX.utils.json_to_sheet([
        {
          'Нийт өдрүүд (ирц)': summary.rows?.[0]?.total_days || 0,
          'Дундаж ажилласан цаг': Number(summary.rows?.[0]?.avg_hours || 0).toFixed(2),
          'Дуусгасан даалгавар': summary.rows?.[0]?.completed_tasks || 0,
          'Уулзалтын тоо': summary.rows?.[0]?.total_meetings || 0,
        },
      ]);
      XLSX.utils.book_append_sheet(workbook, summarySheet, 'Нийлбэр');

      const fileName = `irtsiin_tailan_${employeeId}_${Date.now()}.xlsx`;
      const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' });

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      res.end(buffer);
    } catch (error) {
      console.error('Excel generation error:', error);
      res.status(500).json({ error: error.message });
    }
  }

  static async generatePDFReport(employeeId, startDate, endDate, res) {
    try {
      const { regular, bold } = getPdfFonts();

      const doc = new PDFDocument({ margin: 50 });
      const fileName = `irtsiin_tailan_${employeeId}_${Date.now()}.pdf`;
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      doc.pipe(res);

      if (regular) doc.registerFont('mn', regular);
      if (bold) doc.registerFont('mn-bold', bold);

      const has = (name) => Boolean(name && doc._registeredFonts?.[name]);
      const fontRegular = has('mn') ? 'mn' : 'Helvetica';
      const fontBold = has('mn-bold') ? 'mn-bold' : fontRegular;

      const empData = await pool.query(
        'SELECT first_name, last_name, position, department FROM employees WHERE id = ?',
        [employeeId]
      );
      const emp = empData.rows?.[0] || {};
      const fullName = [emp.last_name, emp.first_name].filter(Boolean).join(' ') || '-';

      doc.font(fontBold).fontSize(20).text('Ажилтны тайлан', { align: 'center' });
      doc.font(fontRegular).fontSize(12).text(`${startDate} - ${endDate}`, { align: 'center' });
      doc.moveDown();

      doc.font(fontBold).fontSize(12).text('Ажилтны мэдээлэл:');
      doc.font(fontRegular)
        .fontSize(10)
        .text(`Нэр: ${fullName}`)
        .text(`Албан тушаал: ${emp.position || '-'}`)
        .text(`Хэлтэс: ${emp.department || '-'}`);
      doc.moveDown();

      const attendanceStats = await pool.query(
        'SELECT COUNT(*) as total, COUNT(CASE WHEN check_out_time IS NOT NULL THEN 1 END) as completed FROM attendance WHERE employee_id = ? AND date BETWEEN ? AND ?',
        [employeeId, startDate, endDate]
      );
      const tasksStats = await pool.query(
        "SELECT COUNT(*) as total, COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed FROM tasks WHERE employee_id = ? AND created_at BETWEEN ? AND ?",
        [employeeId, startDate, endDate]
      );

      doc.font(fontBold).fontSize(12).text('Ирцийн товч мэдээлэл:');
      doc.font(fontRegular)
        .fontSize(10)
        .text(`Нийт ирцийн мөр: ${attendanceStats.rows?.[0]?.total ?? 0}`)
        .text(`Бүрэн хаасан өдрүүд: ${attendanceStats.rows?.[0]?.completed ?? 0}`);
      doc.moveDown();

      doc.font(fontBold).fontSize(12).text('Даалгаврын товч мэдээлэл:');
      doc.font(fontRegular)
        .fontSize(10)
        .text(`Нийт даалгавар: ${tasksStats.rows?.[0]?.total ?? 0}`)
        .text(`Дуусгасан даалгавар: ${tasksStats.rows?.[0]?.completed ?? 0}`);
      doc.moveDown();

      const attendanceData = await pool.query(
        'SELECT date, check_in_time, check_out_time, hours_worked, outside_worked_hours, outside_work_location FROM attendance WHERE employee_id = ? AND date BETWEEN ? AND ? ORDER BY date LIMIT 20',
        [employeeId, startDate, endDate]
      );
      const leaveData = await pool.query(
        "SELECT leave_date, leave_type FROM leave_requests WHERE employee_id = ? AND leave_date BETWEEN ? AND ? AND status = 'approved' ORDER BY leave_date",
        [employeeId, startDate, endDate]
      );
      const mergedAttendance = mergeAttendanceWithLeave(
        attendanceData.rows || [],
        leaveData.rows || [],
        startDate,
        endDate
      );

      if (mergedAttendance.length) {
        doc.font(fontBold).fontSize(12).text('Ирцийн дэлгэрэнгүй (эхний 20 мөр):');
        doc.moveDown(0.5);
        doc.font(fontRegular).fontSize(9);

        mergedAttendance.slice(0, 20).forEach((row) => {
          const baseHours = Number(row.hours_worked || 0);
          const outside = Number(row.outside_worked_hours || 0);
          const total = baseHours + outside;
          const line = row.attendance_flag?.startsWith('Чөлөөтэй')
            ? `${formatUlaanDate(row.date)} | ${row.attendance_flag}`
            : `${formatUlaanDate(row.date)} | ${formatUlaanTime(row.check_in_time)} - ${formatUlaanTime(row.check_out_time)} | Нийт: ${total.toFixed(2)} цаг`;
          doc.text(line);
        });
      }

      doc.end();
    } catch (error) {
      console.error('PDF generation error:', error);
      res.status(500).json({ error: error.message });
    }
  }
}

module.exports = ReportGenerator;

