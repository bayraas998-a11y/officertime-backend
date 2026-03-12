const pool = require('../config/database');

class AuditLog {
  static async create(userId, action, resourceType, resourceId, changes = null) {
    try {
      const result = await pool.query(
        `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, changes, timestamp)
         VALUES (?, ?, ?, ?, ?, NOW())
         RETURNING *`,
        [userId, action, resourceType, resourceId, changes ? JSON.stringify(changes) : null]
      );
      return result.rows[0];
    } catch (error) {
      console.error('Failed to create audit log:', error);
      throw error;
    }
  }

  static async getByResourceType(resourceType, limit = 100, offset = 0) {
    try {
      const result = await pool.query(
        `SELECT * FROM audit_logs 
         WHERE resource_type = ? 
         ORDER BY timestamp DESC 
         LIMIT ? OFFSET ?`,
        [resourceType, limit, offset]
      );
      return result.rows;
    } catch (error) {
      console.error('Failed to get audit logs by resource type:', error);
      throw error;
    }
  }

  static async getByUser(userId, limit = 100, offset = 0) {
    try {
      const result = await pool.query(
        `SELECT * FROM audit_logs 
         WHERE user_id = ? 
         ORDER BY timestamp DESC 
         LIMIT ? OFFSET ?`,
        [userId, limit, offset]
      );
      return result.rows;
    } catch (error) {
      console.error('Failed to get audit logs by user:', error);
      throw error;
    }
  }

  static async getByDateRange(startDate, endDate, limit = 100, offset = 0) {
    try {
      const result = await pool.query(
        `SELECT * FROM audit_logs 
         WHERE timestamp BETWEEN ? AND ? 
         ORDER BY timestamp DESC 
         LIMIT ? OFFSET ?`,
        [startDate, endDate, limit, offset]
      );
      return result.rows;
    } catch (error) {
      console.error('Failed to get audit logs by date range:', error);
      throw error;
    }
  }

  static async getAll(limit = 100, offset = 0) {
    try {
      const result = await pool.query(
        `SELECT * FROM audit_logs 
         ORDER BY timestamp DESC 
         LIMIT ? OFFSET ?`,
        [limit, offset]
      );
      return result.rows;
    } catch (error) {
      console.error('Failed to get all audit logs:', error);
      throw error;
    }
  }

  static async getActionSummary(startDate, endDate) {
    try {
      const result = await pool.query(
        `SELECT 
          action,
          COUNT(*) as count,
          COUNT(DISTINCT user_id) as unique_users,
          COUNT(DISTINCT resource_type) as resource_types
         FROM audit_logs 
         WHERE timestamp BETWEEN ? AND ? 
         GROUP BY action
         ORDER BY count DESC`,
        [startDate, endDate]
      );
      return result.rows;
    } catch (error) {
      console.error('Failed to get action summary:', error);
      throw error;
    }
  }

  static async getUserActivitySummary(userId, startDate, endDate) {
    try {
      const result = await pool.query(
        `SELECT 
          action,
          resource_type,
          COUNT(*) as count
         FROM audit_logs 
         WHERE user_id = ? AND timestamp BETWEEN ? AND ? 
         GROUP BY action, resource_type
         ORDER BY count DESC`,
        [userId, startDate, endDate]
      );
      return result.rows;
    } catch (error) {
      console.error('Failed to get user activity summary:', error);
      throw error;
    }
  }
}

module.exports = AuditLog;
