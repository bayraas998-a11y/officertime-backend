const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const path = require('path');

const dbPath = path.join(__dirname, '../data/employee_tracking.db');
const db = new sqlite3.Database(dbPath);

const run = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve({ id: this.lastID, changes: this.changes });
    });
  });

const all = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });

const toDate = (d) => d.toISOString().slice(0, 10);
const toDateTime = (d) => `${d.toISOString().slice(0, 10)} ${d.toISOString().slice(11, 19)}`;

async function ensureLeaveTable() {
  await run(
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
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`
  );
}

async function clearData() {
  const tables = [
    'leave_requests',
    'audit_logs',
    'employee_status',
    'meetings',
    'tasks',
    'attendance',
    'employees',
  ];
  for (const t of tables) {
    await run(`DELETE FROM ${t}`);
  }
  await run(`DELETE FROM sqlite_sequence WHERE name IN (${tables.map(() => '?').join(',')})`, tables);
}

async function seed() {
  await ensureLeaveTable();
  await clearData();

  const passwordHash = await bcrypt.hash('password123', 10);

  const employees = [
    { first_name: 'Баяр', last_name: 'Сүхбаатар', email: 'bayar@company.mn', position: 'Инженер', department: 'IT' },
    { first_name: 'Сарнай', last_name: 'Жамсран', email: 'sarnai@company.mn', position: 'Менежер', department: 'HR' },
    { first_name: 'Номин', last_name: 'Батмөнх', email: 'nomin@company.mn', position: 'Борлуулалт', department: 'Sales' },
    { first_name: 'Тэмүүжин', last_name: 'Нүхэл', email: 'temujin@company.mn', position: 'Хөгжүүлэгч', department: 'IT' },
    { first_name: 'Сүлд', last_name: 'Цэрэн', email: 'suld@company.mn', position: 'Дизайнер', department: 'Design' },
  ];

  const employeeIds = [];
  for (const emp of employees) {
    const result = await run(
      `INSERT INTO employees (first_name, last_name, email, password, position, department, hire_date, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
      [emp.first_name, emp.last_name, emp.email, passwordHash, emp.position, emp.department, '2024-01-15']
    );
    employeeIds.push(result.id);
  }

  // One month demo attendance and tasks
  const today = new Date();
  const start = new Date(today);
  start.setDate(today.getDate() - 30);

  const reasons = ['Эмчийн үзлэг', 'Гэр бүлийн ажил', 'Хүүхэдтэй холбоотой', 'Яаралтай хувийн ажил'];
  const taskTitles = ['API засвар', 'UI шинэчлэл', 'Тайлан бэлтгэх', 'Тест бичих', 'Хурал зохион байгуулах'];

  for (let day = 0; day <= 30; day++) {
    const current = new Date(start);
    current.setDate(start.getDate() + day);
    const dayDate = toDate(current);

    for (let i = 0; i < employeeIds.length; i++) {
      const employeeId = employeeIds[i];

      // 08:30 +/- variation, 17:30 +/- overtime
      const checkIn = new Date(`${dayDate}T08:30:00`);
      checkIn.setMinutes(checkIn.getMinutes() + (i * 3 + day) % 35 - 8);
      const checkOut = new Date(`${dayDate}T17:30:00`);
      checkOut.setMinutes(checkOut.getMinutes() + (i * 5 + day * 2) % 90 - 20);
      const hoursWorked = Math.max(0, (checkOut - checkIn) / (1000 * 60 * 60));

      await run(
        `INSERT INTO attendance (employee_id, check_in_time, check_out_time, date, hours_worked)
         VALUES (?, ?, ?, ?, ?)`,
        [employeeId, toDateTime(checkIn), toDateTime(checkOut), dayDate, hoursWorked]
      );

      if (day % 5 === 0) {
        const title = `${taskTitles[(i + day) % taskTitles.length]} #${day}`;
        const completion = Math.min(100, 20 + ((i + day) * 13) % 90);
        const status = completion >= 100 ? 'completed' : completion > 40 ? 'in_progress' : 'pending';
        await run(
          `INSERT INTO tasks (employee_id, title, description, status, priority, due_date, completion_percentage)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            employeeId,
            title,
            'Автомат тест өгөгдөл',
            status,
            ['low', 'medium', 'high'][(i + day) % 3],
            dayDate,
            completion,
          ]
        );
      }

      if (day % 7 === 0) {
        const meetingDate = new Date(`${dayDate}T10:00:00`);
        await run(
          `INSERT INTO meetings (employee_id, title, description, meeting_date, duration_minutes, location, attendees)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [employeeId, '7 хоногийн төлөвлөгөө', 'Багийн уулзалт', meetingDate.toISOString(), 45 + ((i + day) % 4) * 15, 'Хурлын өрөө', 4 + (i % 3)]
        );
      }
    }
  }

  // Leave requests demo
  for (let i = 0; i < employeeIds.length; i++) {
    const requestDate = new Date(today);
    requestDate.setDate(today.getDate() - (i * 3 + 2));
    const statuses = ['pending', 'approved', 'rejected'];
    await run(
      `INSERT INTO leave_requests (employee_id, leave_date, leave_type, reason, status, manager_note)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        employeeIds[i],
        toDate(requestDate),
        i % 2 === 0 ? 'full_day' : 'half_day',
        reasons[i % reasons.length],
        statuses[i % statuses.length],
        i % 3 === 0 ? null : 'Туршилтын шийдвэр',
      ]
    );
  }

  // Online statuses
  for (const id of employeeIds) {
    await run(
      `INSERT INTO employee_status (employee_id, status, last_seen) VALUES (?, ?, ?)`,
      [id, 'online', new Date().toISOString()]
    );
  }

  const attendanceCount = await all('SELECT COUNT(*) as c FROM attendance');
  const taskCount = await all('SELECT COUNT(*) as c FROM tasks');
  const meetingCount = await all('SELECT COUNT(*) as c FROM meetings');
  const leaveCount = await all('SELECT COUNT(*) as c FROM leave_requests');

  console.log('Seed completed');
  console.log(`Employees: ${employeeIds.length}`);
  console.log(`Attendance rows: ${attendanceCount[0].c}`);
  console.log(`Tasks: ${taskCount[0].c}`);
  console.log(`Meetings: ${meetingCount[0].c}`);
  console.log(`Leave requests: ${leaveCount[0].c}`);
  console.log('Login: bayar@company.mn / password123');
}

seed()
  .then(() => db.close())
  .catch((err) => {
    console.error(err);
    db.close();
    process.exit(1);
  });
