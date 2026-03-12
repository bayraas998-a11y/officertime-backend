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

const get = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });

const ensureUser = async ({
  first_name,
  last_name,
  email,
  password,
  position,
  department,
}) => {
  const existing = await get('SELECT id, email, position FROM employees WHERE email = ?', [email]);
  const passwordHash = await bcrypt.hash(password, 10);

  if (!existing) {
    const result = await run(
      `INSERT INTO employees (first_name, last_name, email, password, position, department, hire_date, is_active)
       VALUES (?, ?, ?, ?, ?, ?, DATE('now'), 1)`,
      [first_name, last_name, email, passwordHash, position, department]
    );
    return { id: result.id, created: true };
  }

  // Keep existing password; only update position/department if needed.
  await run(
    'UPDATE employees SET position = ?, department = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [position, department, existing.id]
  );
  return { id: existing.id, created: false };
};

async function main() {
  const defaultPassword = process.env.DEFAULT_PASSWORD || 'password123';

  // Promote Bayar to admin (if exists). This is a dev-helper so you can manage users.
  const bayar = await get('SELECT id FROM employees WHERE email = ?', ['bayar@company.mn']);
  if (bayar) {
    await run(
      'UPDATE employees SET position = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      ['admin', bayar.id]
    );
    console.log('OK: bayar@company.mn -> admin');
  } else {
    console.log('WARN: bayar@company.mn not found (seed may not have been run).');
  }

  const director = await ensureUser({
    first_name: 'Захирал',
    last_name: 'Систем',
    email: 'zahiral@company.mn',
    password: defaultPassword,
    position: 'Захирал',
    department: 'Удирдлага',
  });

  const employee = await ensureUser({
    first_name: 'Ажилтан',
    last_name: 'Систем',
    email: 'ajiltan@company.mn',
    password: defaultPassword,
    position: 'Ажилтан',
    department: 'IT',
  });

  const dutyOfficer = await ensureUser({
    first_name: 'Жижүүр',
    last_name: 'Систем',
    email: 'jijuur@company.mn',
    password: defaultPassword,
    position: 'Жижүүрийн цагдаа',
    department: 'Хан-Уул цагдаагийн хэлтэс',
  });

  console.log(`OK: zahiral@company.mn (${director.created ? 'created' : 'updated'}) / ${defaultPassword}`);
  console.log(`OK: ajiltan@company.mn (${employee.created ? 'created' : 'updated'}) / ${defaultPassword}`);
  console.log(`OK: jijuur@company.mn (${dutyOfficer.created ? 'created' : 'updated'}) / ${defaultPassword}`);
}

main()
  .then(() => db.close())
  .catch((err) => {
    console.error(err);
    db.close();
    process.exit(1);
  });
