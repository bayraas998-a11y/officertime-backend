const pool = require('../config/database');
const PDFDocument = require('pdfkit');
const ExcelJS = require('xlsx');
const fs = require('fs');
const path = require('path');

class AdvancedReportService {
  async generateEmployeePerformanceReport(employeeId, startDate, endDate) {
    try {
      const employee = await pool.query(
        'SELECT * FROM employees WHERE id = $1',
        [employeeId]
      );

      const attendance = await pool.query(
        'SELECT COUNT(*) as total_days, SUM(CASE WHEN check_out_time IS NOT NULL THEN 1 ELSE 0 END) as full_days, AVG(hours_worked) as avg_hours FROM attendance WHERE employee_id = $1 AND date BETWEEN $2 AND $3',
        [employeeId, startDate, endDate]
      );

      const tasks = await pool.query(
        'SELECT COUNT(*) as total, COUNT(CASE WHEN status = \'completed\' THEN 1 END) as completed, AVG(completion_percentage) as avg_completion FROM tasks WHERE employee_id = $1 AND created_at BETWEEN $2 AND $3',
        [employeeId, startDate, endDate]
      );

      const meetings = await pool.query(
        'SELECT COUNT(*) as total, SUM(attendees) as total_attendees, SUM(duration_minutes) as total_duration FROM meetings WHERE employee_id = $1 AND meeting_date BETWEEN $2 AND $3',
        [employeeId, startDate, endDate]
      );

      const performance = {
        employee: employee.rows[0],
        attendance: attendance.rows[0],
        tasks: tasks.rows[0],
        meetings: meetings.rows[0],
        performanceScore: this.calculatePerformanceScore(attendance.rows[0], tasks.rows[0]),
      };

      return performance;
    } catch (error) {
      console.error('Failed to generate performance report:', error);
      throw error;
    }
  }

  calculatePerformanceScore(attendance, tasks) {
    // Attendance: 40%
    const attendanceScore = (attendance.full_days / attendance.total_days) * 40;
    
    // Tasks: 40%
    const taskScore = (tasks.completed / tasks.total) * 40;
    
    // Completion: 20%
    const completionScore = (tasks.avg_completion / 100) * 20;

    return Math.round(attendanceScore + taskScore + completionScore);
  }

  async generateDepartmentAnalytics(departmentId, startDate, endDate) {
    try {
      const employees = await pool.query(
        'SELECT id, first_name, last_name FROM employees WHERE department = $1 AND is_active = true',
        [departmentId]
      );

      const attendance = await pool.query(
        'SELECT employee_id, COUNT(*) as days_worked, AVG(hours_worked) as avg_hours FROM attendance WHERE employee_id IN (SELECT id FROM employees WHERE department = $1) AND date BETWEEN $2 AND $3 GROUP BY employee_id',
        [departmentId, startDate, endDate]
      );

      const tasks = await pool.query(
        'SELECT employee_id, COUNT(*) as total_tasks, COUNT(CASE WHEN status = \'completed\' THEN 1 END) as completed FROM tasks WHERE employee_id IN (SELECT id FROM employees WHERE department = $1) AND created_at BETWEEN $2 AND $3 GROUP BY employee_id',
        [departmentId, startDate, endDate]
      );

      return {
        department: departmentId,
        totalEmployees: employees.rows.length,
        attendance: attendance.rows,
        tasks: tasks.rows,
      };
    } catch (error) {
      console.error('Failed to generate department analytics:', error);
      throw error;
    }
  }

  async generatePDFReport(employeeId, startDate, endDate, res) {
    try {
      const performance = await this.generateEmployeePerformanceReport(employeeId, startDate, endDate);
      const doc = new PDFDocument();
      const fileName = `performance_report_${employeeId}_${Date.now()}.pdf`;
      const filePath = path.join(__dirname, '../../uploads', fileName);

      const stream = fs.createWriteStream(filePath);
      doc.pipe(stream);

      // Title
      doc.fontSize(20).font('Helvetica-Bold').text('Ажилтны Дүн Шинжилгээ', { align: 'center' });
      doc.fontSize(12).text(`${startDate} - ${endDate}`, { align: 'center' });
      doc.moveDown();

      // Employee Info
      doc.fontSize(14).font('Helvetica-Bold').text('Ажилтны Мэдээлэл');
      doc.fontSize(10).font('Helvetica')
        .text(`Нэр: ${performance.employee.first_name} ${performance.employee.last_name}`)
        .text(`Ажил: ${performance.employee.position}`)
        .text(`Хэлтэс: ${performance.employee.department}`);
      doc.moveDown();

      // Performance Score
      doc.fontSize(14).font('Helvetica-Bold').text('Үндэсний Үнэлгээ');
      doc.fontSize(12).font('Helvetica-Bold').text(`${performance.performanceScore}/100`);
      doc.moveDown();

      // Attendance
      doc.fontSize(12).font('Helvetica-Bold').text('Цаг Хугацаа');
      doc.fontSize(10).font('Helvetica')
        .text(`Нийт өдрүүд: ${performance.attendance.total_days}`)
        .text(`Бүтэн өдрүүд: ${performance.attendance.full_days}`)
        .text(`Дундаж цаг: ${performance.attendance.avg_hours?.toFixed(2)} цаг`);
      doc.moveDown();

      // Tasks
      doc.fontSize(12).font('Helvetica-Bold').text('Ажлууд');
      doc.fontSize(10).font('Helvetica')
        .text(`Нийт: ${performance.tasks.total}`)
        .text(`Дуусгасан: ${performance.tasks.completed}`)
        .text(`Дундаж хийлт: ${performance.tasks.avg_completion?.toFixed(1)}%`);

      doc.end();

      stream.on('finish', () => {
        res.download(filePath, fileName, (err) => {
          if (err) console.error('Download error:', err);
          fs.unlink(filePath, (unlinkErr) => {
            if (unlinkErr) console.error('File deletion error:', unlinkErr);
          });
        });
      });
    } catch (error) {
      console.error('PDF generation error:', error);
      res.status(500).json({ error: error.message });
    }
  }
}

module.exports = new AdvancedReportService();
