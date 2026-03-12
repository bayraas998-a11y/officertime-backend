const express = require('express');
const MeetingRequest = require('../models/MeetingRequest');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

router.use(authMiddleware);

const isDutyOfficer = (position) => {
  const p = String(position || '').toLowerCase();
  return p.includes('жиж') || p.includes('duty');
};

const CATEGORY_SET = new Set(['Иргэн', 'Прокурор', 'Шүүх', 'Шүүх эмнэлэг', 'Сургалт', 'Хурал', 'Бусад']);

router.get('/', async (req, res) => {
  try {
    const scope = String(req.query.scope || '').toLowerCase();
    const employeeId = Number(req.employee.id);

    if (scope === 'incoming') {
      const rows = await MeetingRequest.listIncoming(employeeId);
      return res.json(rows);
    }

    const rows = await MeetingRequest.listForCreator(employeeId);
    return res.json(rows);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.post('/', async (req, res) => {
  try {
    // Register meeting request (typically duty officer).
    const employeeId = Number(req.employee.id);
    if (!isDutyOfficer(req.employee.position)) {
      return res.status(403).json({ message: 'Уулзалтын хүсэлт бүртгэх эрх хүрэхгүй байна.' });
    }

    const body = req.body || {};
    const citizen_last_name = String(body.citizen_last_name || '').trim();
    const citizen_first_name = String(body.citizen_first_name || '').trim();
    const citizen_regno = String(body.citizen_regno || '').trim();
    const citizen_gender = String(body.citizen_gender || '').trim().toLowerCase();
    const citizen_phone = String(body.citizen_phone || '').trim();
    const reason = String(body.reason || '').trim();
    const meeting_category = String(body.meeting_category || '').trim();
    const requested_meet_with_employee_id = Number(body.requested_meet_with_employee_id);

    if (!citizen_last_name || !citizen_first_name || !citizen_regno || !reason || !requested_meet_with_employee_id) {
      return res.status(400).json({ message: 'Мэдээллээ бүрэн оруулна уу.' });
    }
    if (citizen_gender && citizen_gender !== 'male' && citizen_gender !== 'female') {
      return res.status(400).json({ message: 'Хүйс буруу байна.' });
    }

    const row = await MeetingRequest.create(employeeId, {
      citizen_last_name,
      citizen_first_name,
      citizen_regno,
      citizen_gender: citizen_gender || null,
      citizen_phone: citizen_phone || null,
      reason,
      meeting_category: CATEGORY_SET.has(meeting_category) ? meeting_category : 'Бусад',
      requested_meet_with_employee_id,
    });

    return res.status(201).json({ message: 'Уулзалтын хүсэлт бүртгэгдлээ.', data: row });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.put('/:id/approve', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const employeeId = Number(req.employee.id);
    const existing = await MeetingRequest.getById(id);
    if (!existing) return res.status(404).json({ message: 'Хүсэлт олдсонгүй.' });

    const isTarget = Number(existing.requested_meet_with_employee_id) === employeeId;
    if (!isTarget) {
      return res.status(403).json({ message: 'Эрх хүрэхгүй байна.' });
    }
    if (existing.status !== 'pending') {
      return res.status(400).json({ message: 'Энэ хүсэлт дээр шийдвэр гарсан байна.' });
    }

    const body = req.body || {};
    const scheduled_at = String(body.scheduled_at || '').trim();
    const scheduled_duration_minutes = Number(body.scheduled_duration_minutes);
    const note = body.note != null ? String(body.note).trim() : null;

    if (!scheduled_at) return res.status(400).json({ message: 'Уулзалтын цаг сонгоно уу.' });
    if (!Number.isFinite(scheduled_duration_minutes) || scheduled_duration_minutes <= 0 || scheduled_duration_minutes > 480) {
      return res.status(400).json({ message: 'Уулзалтын хугацаа буруу байна.' });
    }

    const row = await MeetingRequest.approve(id, employeeId, scheduled_at, scheduled_duration_minutes, note);
    return res.json({ message: 'Зөвшөөрлөө.', data: row });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.put('/:id/reject', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const employeeId = Number(req.employee.id);
    const existing = await MeetingRequest.getById(id);
    if (!existing) return res.status(404).json({ message: 'Хүсэлт олдсонгүй.' });

    const isTarget = Number(existing.requested_meet_with_employee_id) === employeeId;
    if (!isTarget) {
      return res.status(403).json({ message: 'Эрх хүрэхгүй байна.' });
    }
    if (existing.status !== 'pending') {
      return res.status(400).json({ message: 'Энэ хүсэлт дээр шийдвэр гарсан байна.' });
    }

    const note = req.body?.note != null ? String(req.body.note).trim() : null;
    const row = await MeetingRequest.reject(id, employeeId, note);
    return res.json({ message: 'Татгалзлаа.', data: row });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.put('/:id/complete', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const employeeId = Number(req.employee.id);
    const existing = await MeetingRequest.getById(id);
    if (!existing) return res.status(404).json({ message: 'Хүсэлт олдсонгүй.' });

    const isTarget = Number(existing.requested_meet_with_employee_id) === employeeId;
    const isCreator = Number(existing.created_by_employee_id) === employeeId;
    if (!isTarget && !isCreator) {
      return res.status(403).json({ message: 'Эрх хүрэхгүй байна.' });
    }
    if (existing.status !== 'approved') {
      return res.status(400).json({ message: 'Зөвшөөрөгдсөн хүсэлтийг л дуусгах боломжтой.' });
    }

    const actual_duration_minutes = Number(req.body?.actual_duration_minutes);
    const note = req.body?.note != null ? String(req.body.note).trim() : null;
    if (!Number.isFinite(actual_duration_minutes) || actual_duration_minutes <= 0 || actual_duration_minutes > 480) {
      return res.status(400).json({ message: 'Уулзсан хугацаа буруу байна.' });
    }

    const row = await MeetingRequest.complete(id, employeeId, actual_duration_minutes, note);
    return res.json({ message: 'Уулзалтыг дуусгалаа.', data: row });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

module.exports = router;
