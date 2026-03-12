const pool = require('../config/database');

class SocketService {
  constructor(io) {
    this.io = io;
    this.setupEvents();
  }

  setupEvents() {
    this.io.on('connection', (socket) => {
      console.log('User connected:', socket.id);

      // Ажилтан нэвтэрсэн үед
      socket.on('user_login', async (employeeId) => {
        try {
          await pool.query(
            'UPDATE employee_status SET status = $1, last_seen = CURRENT_TIMESTAMP WHERE employee_id = $2',
            ['online', employeeId]
          );

          // Бүх клиентэд мэдэгдэнэ
          this.io.emit('employee_online', { employeeId, status: 'online' });
        } catch (error) {
          console.error('Error updating status:', error);
        }
      });

      // Attendance оновлолт
      socket.on('attendance_updated', (data) => {
        this.io.emit('attendance_changed', data);
      });

      // Task оновлолт
      socket.on('task_updated', (data) => {
        this.io.emit('task_changed', data);
      });

      // Ажилтан салсан үед
      socket.on('user_logout', async (employeeId) => {
        try {
          await pool.query(
            'UPDATE employee_status SET status = $1, last_seen = CURRENT_TIMESTAMP WHERE employee_id = $2',
            ['offline', employeeId]
          );

          this.io.emit('employee_offline', { employeeId, status: 'offline' });
        } catch (error) {
          console.error('Error updating status:', error);
        }
      });

      socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
      });
    });
  }

  // Attendance оновлолтыг мэдэгдэх
  broadcastAttendanceUpdate(employeeId, data) {
    this.io.emit('attendance_update', { employeeId, ...data });
  }

  // Task оновлолтыг мэдэгдэх
  broadcastTaskUpdate(employeeId, data) {
    this.io.emit('task_update', { employeeId, ...data });
  }
}

module.exports = SocketService;
