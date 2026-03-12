const pool = require('../config/database');

class Department {
  static async getAllActive() {
    const result = await pool.query(
      `SELECT id, code, name, address, lat, lng, radius_m
       FROM departments
       WHERE is_active = 1
       ORDER BY name ASC`
    );
    return result.rows || [];
  }

  static async getById(id) {
    return await pool.get('SELECT * FROM departments WHERE id = ?', [id]);
  }
}

module.exports = Department;

