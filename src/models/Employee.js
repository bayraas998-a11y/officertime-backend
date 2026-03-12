const pool = require('../config/database');

const pick = (obj, keys) => {
  const out = {};
  for (const k of keys) {
    if (Object.prototype.hasOwnProperty.call(obj, k)) out[k] = obj[k];
  }
  return out;
};

class Employee {
  static async getDirectory() {
    const result = await pool.query(
      `SELECT id, first_name, last_name, position, department, department_id
       FROM employees
       WHERE is_active = 1
         AND approval_status = 'approved'
         AND COALESCE(is_archived, 0) = 0
       ORDER BY last_name ASC, first_name ASC`
    );
    return result.rows || [];
  }

  static async getAll({ includeInactive = false, includeArchived = false } = {}) {
    const whereParts = [];
    if (!includeArchived) whereParts.push('COALESCE(e.is_archived, 0) = 0');
    if (!includeInactive) {
      whereParts.push('e.is_active = 1');
      whereParts.push("e.approval_status = 'approved'");
    }
    const where = whereParts.length ? `WHERE ${whereParts.join(' AND ')}` : '';
    const result = await pool.all(
      `SELECT
        e.id,
        e.first_name,
        e.last_name,
        e.email,
        e.phone,
        e.position,
        e.department,
        e.department_id,
        e.age,
        e.rank,
        e.is_active,
        COALESCE(e.is_archived, 0) as is_archived,
        e.approval_status,
        e.approved_at,
        e.created_at
       FROM employees e
       ${where}
       ORDER BY e.is_active DESC, e.approval_status ASC, e.last_name ASC, e.first_name ASC`
    );
    return result.rows || result;
  }

  static async getPending() {
    const result = await pool.all(
      `SELECT
        id, first_name, last_name, email, phone, position, department, department_id, age, rank,
        approval_status, is_active, created_at
       FROM employees
       WHERE approval_status = 'pending'
         AND COALESCE(is_archived, 0) = 0
       ORDER BY created_at ASC`
    );
    return result.rows || result;
  }

  static async getById(id) {
    const result = await pool.get('SELECT * FROM employees WHERE id = ?', [id]);
    return result;
  }

  static async getByEmail(email) {
    const result = await pool.get('SELECT * FROM employees WHERE email = ?', [email]);
    return result;
  }

  static async create(data) {
    const {
      first_name,
      last_name,
      email,
      phone,
      password,
      position,
      department,
      department_id,
      age,
      rank,
      hire_date,
      is_active,
      approval_status,
      approved_by,
      approved_at,
    } = data;

    const result = await pool.run(
      `INSERT INTO employees
        (first_name, last_name, email, phone, password, position, department, department_id, age, rank, hire_date, is_active, approval_status, approved_by, approved_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        first_name,
        last_name,
        email,
        phone || null,
        password,
        position || null,
        department || null,
        department_id || null,
        Number.isFinite(Number(age)) ? Number(age) : null,
        rank || null,
        hire_date || null,
        typeof is_active === 'number' ? is_active : typeof is_active === 'boolean' ? (is_active ? 1 : 0) : 1,
        approval_status || 'approved',
        approved_by || null,
        approved_at || null,
      ]
    );
    return { id: result.id, ...data };
  }

  static async update(id, data) {
    const allowed = pick(data || {}, [
      'first_name',
      'last_name',
      'email',
      'phone',
      'position',
      'department',
      'department_id',
      'age',
      'rank',
      'is_active',
      'approval_status',
    ]);

    const fields = Object.keys(allowed);
    if (!fields.length) return await this.getById(id);

    const setSql = fields.map((k) => `${k} = ?`).join(', ');
    const params = fields.map((k) => allowed[k]);
    params.push(id);

    await pool.run(
      `UPDATE employees SET ${setSql}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      params
    );
    return await this.getById(id);
  }

  static async approve(id, approvedBy) {
    await pool.run(
      `UPDATE employees
       SET approval_status = 'approved',
           is_active = 1,
           approved_by = ?,
           approved_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [approvedBy, id]
    );
    return await this.getById(id);
  }

  static async activate(id, activatedBy) {
    await pool.run(
      `UPDATE employees
       SET approval_status = 'approved',
           is_active = 1,
           approved_by = COALESCE(approved_by, ?),
           approved_at = COALESCE(approved_at, CURRENT_TIMESTAMP),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [activatedBy, id]
    );
    return await this.getById(id);
  }

  static async reject(id, approvedBy, note = null) {
    // Keep the record, but block login.
    await pool.run(
      `UPDATE employees
       SET approval_status = 'rejected',
           is_active = 0,
           approved_by = ?,
           approved_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [approvedBy, id]
    );
    return await this.getById(id);
  }

  static async delete(id) {
    await pool.run(
      'UPDATE employees SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [id]
    );
    return await this.getById(id);
  }
}

module.exports = Employee;
