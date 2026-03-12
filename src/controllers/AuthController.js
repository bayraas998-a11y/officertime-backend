const Employee = require('../models/Employee');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { normalizeRole } = require('../utils/role');

class AuthController {
  static async requestRegister(req, res) {
    try {
      const { first_name, last_name, age, rank, department_id, department, position, phone, email, password } =
        req.body || {};

      if (!first_name || !last_name || !email || !password) {
        return res.status(400).json({ message: 'Мэдээллээ бүрэн оруулна уу.' });
      }

      const existing = await Employee.getByEmail(email);
      if (existing) {
        return res.status(400).json({ message: 'Энэ имэйл бүртгэлтэй байна.' });
      }

      const hashedPassword = await bcrypt.hash(password, 10);

      // If department_id is provided but department name isn't, resolve it for display/use.
      let departmentName = department || null;
      const depId = department_id ? Number(department_id) : null;
      if (!departmentName && depId) {
        try {
          const pool = require('../config/database');
          const dep = await pool.get('SELECT name FROM departments WHERE id = ? AND is_active = 1', [depId]);
          departmentName = dep?.name ? String(dep.name) : null;
        } catch {
          departmentName = null;
        }
      }

      await Employee.create({
        first_name,
        last_name,
        email,
        phone: phone || null,
        password: hashedPassword,
        position: position || null,
        department: departmentName,
        department_id: depId || null,
        age: age || null,
        rank: rank || null,
        hire_date: new Date(),
        is_active: 0,
        approval_status: 'pending',
      });

      return res.status(201).json({
        message: 'Бүртгэлийн хүсэлт илгээгдлээ. Админ баталгаажуулсны дараа нэвтрэх боломжтой.',
      });
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  static async register(req, res) {
    try {
      const { first_name, last_name, email, password, position, department } = req.body;

      const existing = await Employee.getByEmail(email);
      if (existing) {
        return res.status(400).json({ message: 'Энэ имэйл бүртгэлтэй байна.' });
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      const employee = await Employee.create({
        first_name,
        last_name,
        email,
        password: hashedPassword,
        position,
        department,
        hire_date: new Date()
      });

      const role = normalizeRole(employee.position);
      const token = jwt.sign(
        { id: employee.id, email: employee.email, role, position: employee.position || null },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRE }
      );

      res.status(201).json({
        message: 'Бүртгэл үүслээ.',
        token,
        employee: {
          id: employee.id,
          first_name: employee.first_name,
          last_name: employee.last_name,
          email: employee.email,
          position: employee.position || null,
          role,
        },
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  static async login(req, res) {
    try {
      const { email, password } = req.body;

      const employee = await Employee.getByEmail(email);
      if (!employee) {
        return res.status(401).json({ message: 'Имэйл эсвэл нууц үг буруу байна.' });
      }

      if (String(employee.approval_status || '').toLowerCase() === 'rejected') {
        return res.status(403).json({ message: 'Таны бүртгэл татгалзсан байна. Админтай холбогдоно уу.' });
      }
      if (String(employee.approval_status || '').toLowerCase() === 'pending' || Number(employee.is_active) === 0) {
        return res.status(403).json({ message: 'Таны бүртгэл хүлээгдэж байна. Админ баталгаажуулсны дараа нэвтэрнэ.' });
      }

      const validPassword = await bcrypt.compare(password, employee.password);
      if (!validPassword) {
        return res.status(401).json({ message: 'Имэйл эсвэл нууц үг буруу байна.' });
      }

      const role = normalizeRole(employee.position);
      const token = jwt.sign(
        { id: employee.id, email: employee.email, role, position: employee.position || null },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRE }
      );

      res.json({
        message: 'Нэвтрэлт амжилттай.',
        token,
        employee: {
          id: employee.id,
          first_name: employee.first_name,
          last_name: employee.last_name,
          email: employee.email,
          position: employee.position || null,
          role,
        },
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
}

module.exports = AuthController;
