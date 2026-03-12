const Task = require('../models/Task');
const { isLeaderRole } = require('../utils/role');

const STATUS_TRANSITIONS = {
  pending: ['in_progress'],
  in_progress: [],
  completed: [],
};

class TaskController {
  static async getEmployeeTasks(req, res) {
    try {
      const employeeId = req.employee.id;
      const scope = String(req.query.scope || 'visible').toLowerCase();

      let tasks;
      if (scope === 'assigned') {
        tasks = await Task.getAssignedToEmployee(employeeId);
      } else if (scope === 'created') {
        tasks = await Task.getCreatedByEmployee(employeeId);
      } else {
        tasks = await Task.getByEmployee(employeeId);
      }

      const normalizedTasks = await Promise.all(tasks.map(async (task) => {
        const isAssignee = await Task.isEmployeeAssigned(task.id, employeeId);
        const isCreator = Number(task.created_by_employee_id || task.employee_id) === Number(employeeId);
        return {
          ...task,
          is_assignee: isAssignee,
          is_creator: isCreator,
          can_request_extension: isAssignee && Number(task.active_assignee_count || 1) <= 1,
          can_resolve: isAssignee && task.status !== 'completed',
          can_review_extension: isCreator && !isAssignee,
          can_delete: isCreator && Number(task.employee_id) === Number(employeeId),
        };
      }));
      res.json(normalizedTasks);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  static async getTaskStats(req, res) {
    try {
      const employeeId = req.employee.id;
      const stats = await Task.getStats(employeeId);
      const completionPercentage = stats.total_tasks > 0 
        ? (stats.completed_tasks / stats.total_tasks * 100).toFixed(2)
        : 0;
      
      res.json({
        totalTasks: stats.total_tasks,
        completedTasks: stats.completed_tasks,
        completionPercentage: parseFloat(completionPercentage),
        avgCompletionPercentage: stats.avg_completion_percentage
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  static async createTask(req, res) {
    try {
      const createdBy = req.employee.id;
      const { title, description, priority, due_date } = req.body;

      const rawIds = Array.isArray(req.body.assignee_ids)
        ? req.body.assignee_ids
        : Array.isArray(req.body.employee_ids)
          ? req.body.employee_ids
          : req.body.employee_id
            ? [req.body.employee_id]
            : [];

      const assigneeIds = [...new Set(rawIds.map((v) => Number(v)).filter((v) => v > 0))];

      // If the UI didn't send assignees, default to self (still valid for leaders).
      const finalAssignees = assigneeIds.length ? assigneeIds : [Number(createdBy)];

      const task = await Task.createWithAssignees(createdBy, finalAssignees, {
        title,
        description,
        priority,
        due_date,
      });
      res.status(201).json(task);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  static async updateTask(req, res) {
    try {
      const { id } = req.params;
      const data = req.body;

      const existing = await Task.getById(id);
      if (!existing) {
        return res.status(404).json({ error: 'Task not found' });
      }

      const isAssignee = Number(existing.employee_id) === Number(req.employee.id);
      const isCreator = Number(existing.created_by_employee_id || existing.employee_id) === Number(req.employee.id);
      if (!isAssignee && !isCreator && !isLeaderRole(req.employee.role)) {
        return res.status(403).json({ error: 'No permission to update this task' });
      }

      if (data.status && data.status !== existing.status) {
        if (data.status === 'completed') {
          return res.status(400).json({ error: 'Use resolve endpoint to complete task' });
        }
        const allowedNext = STATUS_TRANSITIONS[existing.status] || [];
        if (!allowedNext.includes(data.status)) {
          return res.status(400).json({ error: `Invalid status transition from ${existing.status} to ${data.status}` });
        }
      }

      const task = await Task.update(id, data);
      res.json(task);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  static async deleteTask(req, res) {
    try {
      const { id } = req.params;

      const task = await Task.getById(id);
      if (!task) {
        return res.status(404).json({ error: 'Task not found' });
      }

      if (Number(task.employee_id) !== Number(req.employee.id)) {
        return res.status(403).json({ error: 'You can only delete your own assigned tasks' });
      }

      if (Number(task.created_by_employee_id || task.employee_id) !== Number(req.employee.id)) {
        return res.status(403).json({ error: 'Transferred/received tasks cannot be deleted' });
      }

      await Task.delete(id);
      res.json({ message: 'Task deleted' });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  static async reassignTask(req, res) {
    try {
      const { id } = req.params;
      const { employee_id } = req.body;
      const rawEmployeeIds = Array.isArray(req.body.employee_ids)
        ? req.body.employee_ids
        : [employee_id];
      const employeeIds = [...new Set(rawEmployeeIds.map((value) => Number(value)).filter((value) => value > 0))];

      if (!employeeIds.length) {
        return res.status(400).json({ error: 'employee_id or employee_ids is required' });
      }

      const existing = await Task.getById(id);
      if (!existing) {
        return res.status(404).json({ error: 'Task not found' });
      }

      const isAssignee = await Task.isEmployeeAssigned(id, req.employee.id);
      if (!isLeaderRole(req.employee.role) && !isAssignee) {
        return res.status(403).json({ error: 'Only leaders or assignees can transfer tasks' });
      }

      const task = await Task.reassignMany(id, employeeIds, req.employee.id);
      if (!task) {
        return res.status(404).json({ error: 'Task not found' });
      }

      res.json(task);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  static async requestExtension(req, res) {
    try {
      const { id } = req.params;
      const { requested_due_date, request_note } = req.body;

      if (!requested_due_date) {
        return res.status(400).json({ error: 'requested_due_date is required' });
      }

      const existing = await Task.getById(id);
      if (!existing) {
        return res.status(404).json({ error: 'Task not found' });
      }

      if (existing.status === 'completed') {
        return res.status(400).json({ error: 'Completed tasks cannot request extension' });
      }

      const isAssignee = await Task.isEmployeeAssigned(id, req.employee.id);
      if (!isAssignee) {
        return res.status(403).json({ error: 'Only assignee can request extension' });
      }

      if (Number(existing.active_assignee_count || 1) > 1) {
        return res.status(400).json({ error: 'Collaborative tasks cannot request extension' });
      }

      const updated = await Task.requestExtension(id, requested_due_date, request_note);
      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  static async reviewExtension(req, res) {
    try {
      const { id } = req.params;
      const { action, review_note } = req.body;

      if (!['approve', 'reject'].includes(action)) {
        return res.status(400).json({ error: "action must be 'approve' or 'reject'" });
      }

      const existing = await Task.getById(id);
      if (!existing) {
        return res.status(404).json({ error: 'Task not found' });
      }

      if (!isLeaderRole(req.employee.role)) {
        return res.status(403).json({ error: 'Only leaders can review extension requests' });
      }

      const creatorId = Number(existing.created_by_employee_id || existing.employee_id);
      if (creatorId !== Number(req.employee.id)) {
        return res.status(403).json({ error: 'Only task owner can review extension request' });
      }

      if (existing.extension_request_status !== 'pending') {
        return res.status(400).json({ error: 'No pending extension request' });
      }

      const updated = await Task.reviewExtension(id, action, review_note);
      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  static async resolveTask(req, res) {
    try {
      const { id } = req.params;
      const { resolution_note, resolution_file_name, resolution_file_data } = req.body;

      if (!resolution_note || !resolution_file_name || !resolution_file_data) {
        return res.status(400).json({ error: 'resolution_note, resolution_file_name, resolution_file_data are required' });
      }

      const existing = await Task.getById(id);
      if (!existing) {
        return res.status(404).json({ error: 'Task not found' });
      }

      const isAssignee = await Task.isEmployeeAssigned(id, req.employee.id);
      if (!isAssignee) {
        return res.status(403).json({ error: 'Only assignee can resolve task' });
      }

      const task = await Task.resolve(id, resolution_note, resolution_file_name, resolution_file_data);
      res.json(task);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
}

module.exports = TaskController;
