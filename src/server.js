const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { Server } = require('socket.io');
const http = require('http');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const attendanceRoutes = require('./routes/attendance');
const taskRoutes = require('./routes/tasks');
const meetingRoutes = require('./routes/meetings');
const meetingRequestRoutes = require('./routes/meetingRequests');
const reportRoutes = require('./routes/reports');
const employeeRoutes = require('./routes/employees');
const directoryRoutes = require('./routes/directory');
const analyticsRoutes = require('./routes/analytics');
const auditRoutes = require('./routes/audit');
const leaveRoutes = require('./routes/leave');
const settingsRoutes = require('./routes/settings');
const departmentRoutes = require('./routes/departments');
const adminRoutes = require('./routes/admin');
const SocketService = require('./services/socketService');
const ArchiveService = require('./services/archiveService');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Initialize Socket Service
new SocketService(io);

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'Server is running' });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/meetings', meetingRoutes);
app.use('/api/meeting-requests', meetingRequestRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/directory', directoryRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/audit-logs', auditRoutes);
app.use('/api/leave-requests', leaveRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/departments', departmentRoutes);
app.use('/api/admin', adminRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`WebSocket available at ws://localhost:${PORT}`);

  // Auto-archive: employees who have been inactive for 3+ years.
  // Runs once shortly after startup and then every 24 hours.
  const enabled = String(process.env.AUTO_ARCHIVE_ENABLED || '1') !== '0';
  const years = Number(process.env.AUTO_ARCHIVE_YEARS || 3);
  if (enabled) {
    setTimeout(() => {
      ArchiveService.runAutoArchive({ years, limit: 200 })
        .then((r) => {
          if (r?.archived?.length) {
            console.log(`[auto-archive] archived=${r.archived.length} failed=${r.failed.length}`);
          }
        })
        .catch((e) => console.error('[auto-archive] error:', e?.message || e));
    }, 10_000);

    setInterval(() => {
      ArchiveService.runAutoArchive({ years, limit: 200 }).catch((e) =>
        console.error('[auto-archive] error:', e?.message || e)
      );
    }, 24 * 60 * 60 * 1000);
  }
});

// Export io for use in controllers
app.locals.io = io;

module.exports = app;
