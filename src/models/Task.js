const pool = require('../config/database');

const TASK_SELECT_BASE = `
  SELECT
    t.*,
    COALESCE(tas.active_assignee_count, 1) AS active_assignee_count,
    COALESCE(tas.assignee_names, '') AS assignee_names
  FROM tasks t
  LEFT JOIN (
    SELECT
      ta.task_id,
      COUNT(*) AS active_assignee_count,
      GROUP_CONCAT(e.last_name || ' ' || e.first_name, ', ') AS assignee_names
    FROM task_assignees ta
    JOIN employees e ON e.id = ta.employee_id
    GROUP BY ta.task_id
  ) tas ON tas.task_id = t.id
`;

class Task {
  static async getById(id) {
    const result = await pool.query(`${TASK_SELECT_BASE} WHERE t.id = ?`, [id]);
    return result.rows[0];
  }

  static async getByEmployee(employeeId) {
    const result = await pool.query(
      `${TASK_SELECT_BASE}
       WHERE COALESCE(t.created_by_employee_id, t.employee_id) = ?
          OR EXISTS (SELECT 1 FROM task_assignees ta WHERE ta.task_id = t.id AND ta.employee_id = ?)
       ORDER BY t.due_date ASC, t.id DESC`,
      [employeeId, employeeId]
    );
    return result.rows;
  }

  static async getAssignedToEmployee(employeeId) {
    const result = await pool.query(
      `${TASK_SELECT_BASE}
       WHERE EXISTS (SELECT 1 FROM task_assignees ta WHERE ta.task_id = t.id AND ta.employee_id = ?)
         AND COALESCE(t.created_by_employee_id, t.employee_id) != ?
       ORDER BY t.due_date ASC, t.id DESC`,
      [employeeId, employeeId]
    );
    return result.rows;
  }

  static async getCreatedByEmployee(employeeId) {
    const result = await pool.query(
      `${TASK_SELECT_BASE}
       WHERE COALESCE(t.created_by_employee_id, t.employee_id) = ?
         AND EXISTS (SELECT 1 FROM task_assignees ta WHERE ta.task_id = t.id AND ta.employee_id != ?)
       ORDER BY t.due_date ASC, t.id DESC`,
      [employeeId, employeeId]
    );
    return result.rows;
  }

  static async getStats(employeeId) {
    const result = await pool.query(
      `SELECT
        COUNT(*) as total_tasks,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_tasks,
        AVG(completion_percentage) as avg_completion_percentage
      FROM tasks WHERE employee_id = ?`,
      [employeeId]
    );
    return result.rows[0];
  }

  static async createWithAssignees(createdByEmployeeId, assigneeIds, data) {
    const { title, description, priority, due_date } = data;
    const uniqueIds = [...new Set((assigneeIds || []).map((v) => Number(v)).filter((v) => v > 0))];
    const primaryId = uniqueIds[0] || Number(createdByEmployeeId);
    const responsibleCount = Math.max(1, uniqueIds.length || 1);

    const insertResult = await pool.run(
      `INSERT INTO tasks
       (employee_id, created_by_employee_id, title, description, priority, due_date, responsible_count, resolved_count)
       VALUES (?, ?, ?, ?, ?, ?, ?, 0)`,
      [primaryId, createdByEmployeeId, title, description, priority, due_date, responsibleCount]
    );

    const finalAssigneeIds = uniqueIds.length ? uniqueIds : [primaryId];
    for (let i = 0; i < finalAssigneeIds.length; i += 1) {
      await pool.run(
        `INSERT OR IGNORE INTO task_assignees (task_id, employee_id, assignee_type, assigned_by)
         VALUES (?, ?, ?, ?)`,
        [insertResult.id, finalAssigneeIds[i], i === 0 ? 'primary' : 'collaborator', createdByEmployeeId]
      );
    }

    return this.getById(insertResult.id);
  }

  // Backward-compatible: create a task assigned to the creator.
  static async create(employeeId, data) {
    return this.createWithAssignees(employeeId, [employeeId], data);
  }

  static async update(id, data) {
    const current = await this.getById(id);
    if (!current) return null;

    const next = {
      title: data.title ?? current.title,
      description: data.description ?? current.description,
      status: data.status ?? current.status,
      priority: data.priority ?? current.priority,
      due_date: data.due_date ?? current.due_date,
      completion_percentage: data.completion_percentage ?? current.completion_percentage,
    };

    await pool.run(
      `UPDATE tasks
       SET title = ?, description = ?, status = ?, priority = ?, due_date = ?, completion_percentage = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [next.title, next.description, next.status, next.priority, next.due_date, next.completion_percentage, id]
    );
    return this.getById(id);
  }

  static async delete(id) {
    const existing = await this.getById(id);
    await pool.run('DELETE FROM tasks WHERE id = ?', [id]);
    return existing;
  }

  static async isEmployeeAssigned(taskId, employeeId) {
    const row = await pool.get(
      'SELECT id FROM task_assignees WHERE task_id = ? AND employee_id = ?',
      [taskId, employeeId]
    );
    return !!row;
  }

  static async getAssigneeIds(taskId) {
    const result = await pool.query(
      'SELECT employee_id FROM task_assignees WHERE task_id = ?',
      [taskId]
    );
    return result.rows.map((row) => Number(row.employee_id));
  }

  static async reassignMany(id, employeeIds, assignedByEmployeeId) {
    const current = await this.getById(id);
    if (!current) return null;

    const uniqueIds = [...new Set((employeeIds || []).map((value) => Number(value)).filter((value) => value > 0))];
    if (!uniqueIds.length) return current;

    const primaryId = uniqueIds[0];

    await pool.run(
      `UPDATE tasks
       SET employee_id = ?,
           responsible_count = ?,
           resolved_count = 0,
           extension_request_status = NULL,
           extension_requested_due_date = NULL,
           extension_request_note = NULL,
           extension_review_note = NULL,
           extension_requested_at = NULL,
           extension_reviewed_at = NULL,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [primaryId, uniqueIds.length, id]
    );

    await pool.run('DELETE FROM task_assignees WHERE task_id = ?', [id]);

    for (let i = 0; i < uniqueIds.length; i += 1) {
      await pool.run(
        `INSERT INTO task_assignees (task_id, employee_id, assignee_type, assigned_by)
         VALUES (?, ?, ?, ?)`,
        [id, uniqueIds[i], i === 0 ? 'primary' : 'collaborator', assignedByEmployeeId || null]
      );
    }

    return this.getById(id);
  }

  static async requestExtension(id, requestedDueDate, requestNote) {
    await pool.run(
      `UPDATE tasks
       SET extension_requested_due_date = ?,
           extension_request_status = 'pending',
           extension_request_note = ?,
           extension_review_note = NULL,
           extension_requested_at = CURRENT_TIMESTAMP,
           extension_reviewed_at = NULL,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [requestedDueDate, requestNote || null, id]
    );
    return this.getById(id);
  }

  static async reviewExtension(id, action, reviewNote) {
    const current = await this.getById(id);
    if (!current) return null;

    if (action === 'approve') {
      await pool.run(
        `UPDATE tasks
         SET due_date = extension_requested_due_date,
             extension_request_status = 'approved',
             extension_review_note = ?,
             extension_reviewed_at = CURRENT_TIMESTAMP,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [reviewNote || null, id]
      );
      return this.getById(id);
    }

    await pool.run(
      `UPDATE tasks
       SET extension_request_status = 'rejected',
           extension_review_note = ?,
           extension_reviewed_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [reviewNote || null, id]
    );
    return this.getById(id);
  }

  static async resolve(id, resolutionNote, resolutionFileName, resolutionFileData) {
    await pool.run(
      `UPDATE tasks
       SET status = 'completed',
           resolved_count = COALESCE(responsible_count, 1),
           resolution_note = ?,
           resolution_file_name = ?,
           resolution_file_data = ?,
           resolved_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [resolutionNote, resolutionFileName, resolutionFileData, id]
    );
    return this.getById(id);
  }
}

module.exports = Task;
