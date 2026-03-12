const sqlite3 = require('sqlite3').verbose();
const path = require('path');
require('dotenv').config();

// SQLite database
const dbPath = path.join(__dirname, '../../data/employee_tracking.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Database connection error:', err);
  } else {
    console.log('✅ SQLite database connected');
    initializeDatabase();
  }
});

// Enable foreign keys
db.run('PRAGMA foreign_keys = ON');

// Wrapper for promise-based queries
const query = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve({ rows });
    });
  });
};

const run = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve({ id: this.lastID, changes: this.changes });
    });
  });
};

// Pool compatibility
const pool = {
  query: query,
  run: run,
  all: (sql, params = []) => query(sql, params),
  get: (sql, params = []) => new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  }),
};

// Initialize database tables
async function initializeDatabase() {
  const backfillTaskCreator = () => {
    db.run(
      'UPDATE tasks SET created_by_employee_id = employee_id WHERE created_by_employee_id IS NULL',
      (err) => {
        if (err) {
          console.error('Error backfilling created_by_employee_id:', err);
        }
      }
    );
  };

  const tables = [
    `CREATE TABLE IF NOT EXISTS employees (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      phone TEXT,
      password TEXT NOT NULL,
      position TEXT,
      department TEXT,
      department_id INTEGER,
      age INTEGER,
      rank TEXT,
      hire_date DATE,
      is_active BOOLEAN DEFAULT 1,
      is_archived BOOLEAN DEFAULT 0,
      approval_status TEXT NOT NULL DEFAULT 'approved' CHECK(approval_status IN ('pending','approved','rejected')),
      approved_by INTEGER,
      approved_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    
    `CREATE TABLE IF NOT EXISTS attendance (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id INTEGER NOT NULL,
      check_in_time TIMESTAMP,
      check_out_time TIMESTAMP,
      outside_start_time TIMESTAMP,
      outside_end_time TIMESTAMP,
      date DATE NOT NULL,
      hours_worked REAL,
      notes TEXT,
      outside_worked_hours REAL DEFAULT 0,
      outside_work_location TEXT,
      outside_work_reason TEXT,
      outside_work_types TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
      UNIQUE(employee_id, date)
    )`,
    
    `CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id INTEGER NOT NULL,
      created_by_employee_id INTEGER,
      title TEXT NOT NULL,
      description TEXT,
      status TEXT DEFAULT 'pending',
      priority TEXT DEFAULT 'medium',
      due_date DATE,
      extension_requested_due_date DATE,
      extension_request_status TEXT CHECK(extension_request_status IN ('pending', 'approved', 'rejected')),
      extension_request_note TEXT,
      extension_review_note TEXT,
      extension_requested_at TIMESTAMP,
      extension_reviewed_at TIMESTAMP,
      resolution_note TEXT,
      resolution_file_name TEXT,
      resolution_file_data TEXT,
      resolved_at TIMESTAMP,
      responsible_count INTEGER DEFAULT 1,
      resolved_count INTEGER DEFAULT 0,
      completion_percentage INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
    )`,

    `CREATE TABLE IF NOT EXISTS task_assignees (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id INTEGER NOT NULL,
      employee_id INTEGER NOT NULL,
      assignee_type TEXT NOT NULL DEFAULT 'primary' CHECK(assignee_type IN ('primary', 'collaborator')),
      assigned_by INTEGER,
      assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(task_id, employee_id),
      FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
      FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
      FOREIGN KEY (assigned_by) REFERENCES employees(id) ON DELETE SET NULL
    )`,
    
    `CREATE TABLE IF NOT EXISTS meetings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      meeting_date TIMESTAMP NOT NULL,
      duration_minutes INTEGER,
      location TEXT,
      attendees INTEGER DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
    )`,

    `CREATE TABLE IF NOT EXISTS meeting_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      created_by_employee_id INTEGER NOT NULL,
      citizen_last_name TEXT NOT NULL,
      citizen_first_name TEXT NOT NULL,
      citizen_regno TEXT NOT NULL,
      citizen_gender TEXT CHECK(citizen_gender IN ('male','female')),
      citizen_phone TEXT,
      reason TEXT NOT NULL,
      meeting_category TEXT,
      requested_meet_with_employee_id INTEGER NOT NULL,
      requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected','completed')),
      scheduled_at TIMESTAMP,
      scheduled_duration_minutes INTEGER,
      decision_note TEXT,
      decided_by INTEGER,
      decided_at TIMESTAMP,
      actual_duration_minutes INTEGER,
      completed_at TIMESTAMP,
      completion_note TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (created_by_employee_id) REFERENCES employees(id) ON DELETE CASCADE,
      FOREIGN KEY (requested_meet_with_employee_id) REFERENCES employees(id) ON DELETE CASCADE,
      FOREIGN KEY (decided_by) REFERENCES employees(id) ON DELETE SET NULL
    )`,
    
    `CREATE TABLE IF NOT EXISTS employee_status (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id INTEGER NOT NULL UNIQUE,
      status TEXT DEFAULT 'offline',
      last_seen TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
    )`,
    
    `CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      action TEXT NOT NULL,
      resource_type TEXT NOT NULL,
      resource_id INTEGER,
      changes TEXT,
      timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES employees(id) ON DELETE CASCADE
    )`,

    `CREATE TABLE IF NOT EXISTS leave_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id INTEGER NOT NULL,
      leave_date DATE NOT NULL,
      leave_type TEXT NOT NULL CHECK(leave_type IN ('full_day', 'half_day')),
      reason TEXT NOT NULL,
      proof_image TEXT,
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'approved', 'rejected')),
      manager_note TEXT,
      reviewed_by INTEGER,
      reviewed_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
      FOREIGN KEY (reviewed_by) REFERENCES employees(id) ON DELETE SET NULL
    )`,

    `CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,

    `CREATE TABLE IF NOT EXISTS departments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE,
      name TEXT NOT NULL,
      address TEXT,
      lat REAL,
      lng REAL,
      radius_m REAL DEFAULT 5,
      is_active BOOLEAN DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,

    `CREATE TABLE IF NOT EXISTS employee_archive (
      id INTEGER,
      first_name TEXT,
      last_name TEXT,
      email TEXT,
      phone TEXT,
      position TEXT,
      department TEXT,
      department_id INTEGER,
      age INTEGER,
      rank TEXT,
      hire_date DATE,
      is_active BOOLEAN,
      approval_status TEXT,
      approved_by INTEGER,
      approved_at TIMESTAMP,
      created_at TIMESTAMP,
      updated_at TIMESTAMP,
      archived_by INTEGER,
      archived_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,

    `CREATE TABLE IF NOT EXISTS attendance_archive (
      id INTEGER,
      employee_id INTEGER,
      check_in_time TIMESTAMP,
      check_out_time TIMESTAMP,
      outside_start_time TIMESTAMP,
      outside_end_time TIMESTAMP,
      date DATE,
      hours_worked REAL,
      notes TEXT,
      outside_worked_hours REAL,
      outside_work_location TEXT,
      outside_work_reason TEXT,
      outside_work_types TEXT,
      created_at TIMESTAMP,
      updated_at TIMESTAMP,
      archived_by INTEGER,
      archived_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`

    ,
    `CREATE TABLE IF NOT EXISTS outside_work_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      attendance_id INTEGER NOT NULL,
      employee_id INTEGER NOT NULL,
      date DATE NOT NULL,
      start_time TIMESTAMP NOT NULL,
      end_time TIMESTAMP,
      location TEXT,
      reason TEXT,
      types TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (attendance_id) REFERENCES attendance(id) ON DELETE CASCADE,
      FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
    )`
  ];

  for (const table of tables) {
    db.run(table, (err) => {
      if (err) console.error('Error creating table:', err);
    });
  }

  // Runtime migration for older DB files
  db.run(
    'ALTER TABLE attendance ADD COLUMN outside_worked_hours REAL DEFAULT 0',
    (err) => {
      if (err && !String(err.message).includes('duplicate column name')) {
        console.error('Error adding outside_worked_hours column:', err);
      }
    }
  );
  db.run(
    'ALTER TABLE attendance ADD COLUMN outside_work_location TEXT',
    (err) => {
      if (err && !String(err.message).includes('duplicate column name')) {
        console.error('Error adding outside_work_location column:', err);
      }
    }
  );
  db.run(
    'ALTER TABLE attendance ADD COLUMN outside_start_time TIMESTAMP',
    (err) => {
      if (err && !String(err.message).includes('duplicate column name')) {
        console.error('Error adding outside_start_time column:', err);
      }
    }
  );
  db.run(
    'ALTER TABLE attendance ADD COLUMN outside_end_time TIMESTAMP',
    (err) => {
      if (err && !String(err.message).includes('duplicate column name')) {
        console.error('Error adding outside_end_time column:', err);
      }
    }
  );
  db.run(
    'ALTER TABLE attendance ADD COLUMN outside_work_reason TEXT',
    (err) => {
      if (err && !String(err.message).includes('duplicate column name')) {
        console.error('Error adding outside_work_reason column:', err);
      }
    }
  );
  db.run(
    'ALTER TABLE attendance ADD COLUMN outside_work_types TEXT',
    (err) => {
      if (err && !String(err.message).includes('duplicate column name')) {
        console.error('Error adding outside_work_types column:', err);
      }
    }
  );

  db.run(
    'ALTER TABLE attendance_archive ADD COLUMN outside_start_time TIMESTAMP',
    (err) => {
      if (err && !String(err.message).includes('duplicate column name')) {
        console.error('Error adding outside_start_time column to attendance_archive:', err);
      }
    }
  );
  db.run(
    'ALTER TABLE attendance_archive ADD COLUMN outside_end_time TIMESTAMP',
    (err) => {
      if (err && !String(err.message).includes('duplicate column name')) {
        console.error('Error adding outside_end_time column to attendance_archive:', err);
      }
    }
  );
  db.run(
    'ALTER TABLE attendance_archive ADD COLUMN outside_work_reason TEXT',
    (err) => {
      if (err && !String(err.message).includes('duplicate column name')) {
        console.error('Error adding outside_work_reason column to attendance_archive:', err);
      }
    }
  );
  db.run(
    'ALTER TABLE attendance_archive ADD COLUMN outside_work_types TEXT',
    (err) => {
      if (err && !String(err.message).includes('duplicate column name')) {
        console.error('Error adding outside_work_types column to attendance_archive:', err);
      }
    }
  );

  db.run(
    'ALTER TABLE meeting_requests ADD COLUMN meeting_category TEXT',
    (err) => {
      if (err && !String(err.message).includes('duplicate column name')) {
        console.error('Error adding meeting_category column:', err);
      }
    }
  );

  // Employee metadata + approval flow
  db.run(
    'ALTER TABLE employees ADD COLUMN department_id INTEGER',
    (err) => {
      if (err && !String(err.message).includes('duplicate column name')) {
        console.error('Error adding department_id column:', err);
      }
    }
  );
  db.run(
    'ALTER TABLE employees ADD COLUMN age INTEGER',
    (err) => {
      if (err && !String(err.message).includes('duplicate column name')) {
        console.error('Error adding age column:', err);
      }
    }
  );
  db.run(
    'ALTER TABLE employees ADD COLUMN rank TEXT',
    (err) => {
      if (err && !String(err.message).includes('duplicate column name')) {
        console.error('Error adding rank column:', err);
      }
    }
  );
  db.run(
    "ALTER TABLE employees ADD COLUMN approval_status TEXT NOT NULL DEFAULT 'approved'",
    (err) => {
      if (err && !String(err.message).includes('duplicate column name')) {
        console.error('Error adding approval_status column:', err);
      }
    }
  );
  db.run(
    'ALTER TABLE employees ADD COLUMN approved_by INTEGER',
    (err) => {
      if (err && !String(err.message).includes('duplicate column name')) {
        console.error('Error adding approved_by column:', err);
      }
    }
  );
  db.run(
    'ALTER TABLE employees ADD COLUMN approved_at TIMESTAMP',
    (err) => {
      if (err && !String(err.message).includes('duplicate column name')) {
        console.error('Error adding approved_at column:', err);
      }
    }
  );

  db.run(
    'ALTER TABLE employees ADD COLUMN is_archived BOOLEAN DEFAULT 0',
    (err) => {
      if (err && !String(err.message).includes('duplicate column name')) {
        console.error('Error adding is_archived column:', err);
      }
    }
  );

  // Seed default departments (idempotent)
  db.serialize(() => {
    db.run(
      `INSERT OR IGNORE INTO departments (code, name, address, lat, lng, radius_m)
       VALUES
         ('KHU', 'Хан-Уул цагдаагийн хэлтэс', 'VVXV+5C3, ХУД - 20 хороо, Улаанбаатар 17042', 47.89798066449861, 106.89354003046269, 5),
         ('SKH', 'Сонгинохайрхан дүүргийн цагдаагийн хэлтэс', '12Б Байр, СХД - 14 хороо, Улаанбаатар 18031', 47.91607958162794, 106.84685983945587, 5),
         ('IT', 'IT хэлтэс', 'WWC7+FGP, ЧД - 4 хороо, Улаанбаатар 15160', 47.92122970084487, 106.91385290717238, 5)`,
      (err) => {
        if (err) console.error('Error seeding departments:', err);
      }
    );
  });

  db.run(
    'ALTER TABLE tasks ADD COLUMN created_by_employee_id INTEGER',
    (err) => {
      if (err && !String(err.message).includes('duplicate column name')) {
        console.error('Error adding created_by_employee_id column:', err);
      } else {
        backfillTaskCreator();
      }
    }
  );

  db.run(
    'ALTER TABLE tasks ADD COLUMN extension_requested_due_date DATE',
    (err) => {
      if (err && !String(err.message).includes('duplicate column name')) {
        console.error('Error adding extension_requested_due_date column:', err);
      }
    }
  );

  db.run(
    'ALTER TABLE tasks ADD COLUMN extension_request_status TEXT',
    (err) => {
      if (err && !String(err.message).includes('duplicate column name')) {
        console.error('Error adding extension_request_status column:', err);
      }
    }
  );

  db.run(
    'ALTER TABLE tasks ADD COLUMN extension_request_note TEXT',
    (err) => {
      if (err && !String(err.message).includes('duplicate column name')) {
        console.error('Error adding extension_request_note column:', err);
      }
    }
  );

  db.run(
    'ALTER TABLE tasks ADD COLUMN extension_review_note TEXT',
    (err) => {
      if (err && !String(err.message).includes('duplicate column name')) {
        console.error('Error adding extension_review_note column:', err);
      }
    }
  );

  db.run(
    'ALTER TABLE tasks ADD COLUMN extension_requested_at TIMESTAMP',
    (err) => {
      if (err && !String(err.message).includes('duplicate column name')) {
        console.error('Error adding extension_requested_at column:', err);
      }
    }
  );

  db.run(
    'ALTER TABLE tasks ADD COLUMN extension_reviewed_at TIMESTAMP',
    (err) => {
      if (err && !String(err.message).includes('duplicate column name')) {
        console.error('Error adding extension_reviewed_at column:', err);
      }
    }
  );

  db.run(
    'ALTER TABLE tasks ADD COLUMN resolution_note TEXT',
    (err) => {
      if (err && !String(err.message).includes('duplicate column name')) {
        console.error('Error adding resolution_note column:', err);
      }
    }
  );

  db.run(
    'ALTER TABLE tasks ADD COLUMN resolution_file_name TEXT',
    (err) => {
      if (err && !String(err.message).includes('duplicate column name')) {
        console.error('Error adding resolution_file_name column:', err);
      }
    }
  );

  db.run(
    'ALTER TABLE tasks ADD COLUMN resolution_file_data TEXT',
    (err) => {
      if (err && !String(err.message).includes('duplicate column name')) {
        console.error('Error adding resolution_file_data column:', err);
      }
    }
  );

  db.run(
    'ALTER TABLE tasks ADD COLUMN resolved_at TIMESTAMP',
    (err) => {
      if (err && !String(err.message).includes('duplicate column name')) {
        console.error('Error adding resolved_at column:', err);
      }
    }
  );

  db.run(
    'ALTER TABLE tasks ADD COLUMN responsible_count INTEGER DEFAULT 1',
    (err) => {
      if (err && !String(err.message).includes('duplicate column name')) {
        console.error('Error adding responsible_count column:', err);
      }
    }
  );

  db.run(
    'ALTER TABLE tasks ADD COLUMN resolved_count INTEGER DEFAULT 0',
    (err) => {
      if (err && !String(err.message).includes('duplicate column name')) {
        console.error('Error adding resolved_count column:', err);
      }
    }
  );

  db.run(
    'UPDATE tasks SET responsible_count = 1 WHERE responsible_count IS NULL OR responsible_count < 1',
    (err) => {
      if (err) {
        console.error('Error backfilling responsible_count:', err);
      }
    }
  );

  // Align responsible_count with current assignees (collaborative tasks).
  db.run(
    `UPDATE tasks
     SET responsible_count = (
       SELECT COUNT(*) FROM task_assignees ta WHERE ta.task_id = tasks.id
     )
     WHERE EXISTS (SELECT 1 FROM task_assignees ta WHERE ta.task_id = tasks.id)`,
    (err) => {
      if (err) {
        console.error('Error syncing responsible_count from task_assignees:', err);
      }
    }
  );

  db.run(
    `UPDATE tasks
     SET resolved_count = CASE
       WHEN status = 'completed' THEN COALESCE(responsible_count, 1)
       ELSE 0
     END
     WHERE resolved_count IS NULL`,
    (err) => {
      if (err) {
        console.error('Error backfilling resolved_count:', err);
      }
    }
  );

  // Keep resolved_count consistent after responsible_count sync.
  db.run(
    `UPDATE tasks
     SET resolved_count = CASE
       WHEN status = 'completed' THEN COALESCE(responsible_count, 1)
       ELSE 0
     END`,
    (err) => {
      if (err) {
        console.error('Error syncing resolved_count:', err);
      }
    }
  );

  db.run(
    `INSERT OR IGNORE INTO task_assignees (task_id, employee_id, assignee_type, assigned_by)
     SELECT id, employee_id, 'primary', created_by_employee_id
     FROM tasks
     WHERE employee_id IS NOT NULL`,
    (err) => {
      if (err) {
        console.error('Error backfilling task_assignees:', err);
      }
    }
  );
}

module.exports = pool;
module.exports.db = db;
