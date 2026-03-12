const express = require('express');
const XLSX = require('xlsx');
const Employee = require('../models/Employee');
const authMiddleware = require('../middleware/auth');
const { requireRoles } = require('../middleware/authorize');
const ArchiveService = require('../services/archiveService');

const router = express.Router();

router.use(authMiddleware);
router.use(requireRoles(['admin']));

router.get('/registration-requests', async (req, res) => {
  try {
    const rows = await Employee.getPending();
    return res.json(rows);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.put('/registration-requests/:id/approve', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ message: 'ID буруу байна.' });
    const row = await Employee.approve(id, req.employee.id);
    if (!row) return res.status(404).json({ message: 'Хүсэлт олдсонгүй.' });
    return res.json({ message: 'Баталгаажууллаа.', employee: row });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.put('/registration-requests/:id/reject', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ message: 'ID буруу байна.' });
    const row = await Employee.reject(id, req.employee.id);
    if (!row) return res.status(404).json({ message: 'Хүсэлт олдсонгүй.' });
    return res.json({ message: 'Татгалзлаа.', employee: row });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.get('/employees/export/excel', async (req, res) => {
  try {
    const employees = await Employee.getAll({ includeInactive: true });
    const sheet = XLSX.utils.json_to_sheet(
      (employees || []).map((e) => ({
        ID: e.id,
        'Овог': e.last_name,
        'Нэр': e.first_name,
        'Имэйл': e.email,
        'Утас': e.phone || '',
        'Хэлтэс': e.department || '',
        'Албан тушаал': e.position || '',
        'Цол': e.rank || '',
        'Нас': e.age || '',
        'Төлөв': e.approval_status || '',
        'Идэвхтэй': e.is_active ? 'Тийм' : 'Үгүй',
        'Бүртгэсэн огноо': e.created_at || '',
      }))
    );

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, sheet, 'Ажилтнууд');
    const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' });

    const fileName = `ajiltan_${Date.now()}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    return res.end(buffer);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.put('/employees/:id/activate', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ message: 'ID буруу байна.' });

    const row = await Employee.activate(id, req.employee.id);
    if (!row) return res.status(404).json({ message: 'Ажилтан олдсонгүй.' });
    return res.json({ message: 'Идэвхжүүллээ.', employee: row });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.post('/employees/:id/archive', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const result = await ArchiveService.archiveEmployee(id, req.employee.id);
    if (!result.ok) return res.status(result.status).json({ message: result.message });
    return res.json(result);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// Archive viewer endpoints
router.get('/archive/employees', async (req, res) => {
  try {
    const limit = req.query.limit;
    const rows = await ArchiveService.listArchivedEmployees(limit);
    return res.json(rows);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.get('/archive/attendance', async (req, res) => {
  try {
    const { employee_id, limit } = req.query;
    const rows = await ArchiveService.listArchivedAttendance(employee_id, limit);
    return res.json(rows);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// Manual run of auto-archive (useful for testing)
router.post('/archive/run', async (req, res) => {
  try {
    const years = req.body?.years ?? req.query.years ?? 3;
    const limit = req.body?.limit ?? req.query.limit ?? 100;
    const result = await ArchiveService.runAutoArchive({ years, limit });
    return res.json({ message: 'Автомат архивлалт ажиллалаа.', ...result });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

module.exports = router;

