const AuditLog = require('../models/AuditLog');

class AuditService {
  async logAction(userId, action, resourceType, resourceId, changes = null) {
    try {
      const auditLog = await AuditLog.create(userId, action, resourceType, resourceId, changes);
      console.log(`Audit log created: ${action} on ${resourceType} by user ${userId}`);
      return auditLog;
    } catch (error) {
      console.error('Failed to log action:', error);
      // Don't throw - audit logging should not break the main operation
    }
  }

  async logEmployeeAction(userId, employeeId, action, changes = null) {
    return this.logAction(userId, action, 'employee', employeeId, changes);
  }

  async logTaskAction(userId, taskId, action, changes = null) {
    return this.logAction(userId, action, 'task', taskId, changes);
  }

  async logAttendanceAction(userId, attendanceId, action, changes = null) {
    return this.logAction(userId, action, 'attendance', attendanceId, changes);
  }

  async logMeetingAction(userId, meetingId, action, changes = null) {
    return this.logAction(userId, action, 'meeting', meetingId, changes);
  }

  async logAuthAction(userId, action, details = null) {
    return this.logAction(userId, action, 'authentication', userId, details);
  }

  async getResourceHistory(resourceType, resourceId) {
    try {
      return await AuditLog.getByResourceType(resourceType);
    } catch (error) {
      console.error('Failed to get resource history:', error);
      return [];
    }
  }

  async getUserHistory(userId, limit = 50) {
    try {
      return await AuditLog.getByUser(userId, limit);
    } catch (error) {
      console.error('Failed to get user history:', error);
      return [];
    }
  }

  async getAuditTrail(startDate, endDate, limit = 100) {
    try {
      return await AuditLog.getByDateRange(startDate, endDate, limit);
    } catch (error) {
      console.error('Failed to get audit trail:', error);
      return [];
    }
  }

  async generateAuditReport(startDate, endDate) {
    try {
      const actionSummary = await AuditLog.getActionSummary(startDate, endDate);
      const auditTrail = await AuditLog.getByDateRange(startDate, endDate, 1000);

      return {
        period: { startDate, endDate },
        totalActions: auditTrail.length,
        actionSummary,
        auditTrail,
        generatedAt: new Date().toISOString(),
      };
    } catch (error) {
      console.error('Failed to generate audit report:', error);
      throw error;
    }
  }
}

module.exports = new AuditService();
