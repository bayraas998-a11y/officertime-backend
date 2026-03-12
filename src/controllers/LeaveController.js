const LeaveRequest = require('../models/LeaveRequest');

const normalizeLeaveDate = (value) => {
  if (!value) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
};

class LeaveController {
  static async create(req, res) {
    try {
      const employeeId = req.employee.id;
      const { leave_date, leave_type, reason, proof_image } = req.body;
      const normalizedDate = normalizeLeaveDate(leave_date);

      if (!normalizedDate || !leave_type || !reason) {
        return res.status(400).json({ message: 'Огноо, төрөл, шалтгаан заавал шаардлагатай.' });
      }
      if (!['full_day', 'half_day'].includes(leave_type)) {
        return res.status(400).json({ message: 'Чөлөөний төрөл буруу байна.' });
      }

      const leave = await LeaveRequest.create(employeeId, {
        leave_date: normalizedDate,
        leave_type,
        reason,
        proof_image,
      });

      res.status(201).json({ message: 'Чөлөөний хүсэлт илгээгдлээ.', data: leave });
    } catch (error) {
      res.status(500).json({ message: 'Чөлөөний хүсэлт үүсгэхэд алдаа гарлаа.', error: error.message });
    }
  }

  static async getMine(req, res) {
    try {
      const employeeId = req.employee.id;
      const rows = await LeaveRequest.getByEmployee(employeeId);
      res.json(rows);
    } catch (error) {
      res.status(500).json({ message: 'Чөлөөний хүсэлтийн жагсаалт авахад алдаа гарлаа.', error: error.message });
    }
  }

  static async getAll(req, res) {
    try {
      const rows = await LeaveRequest.getAll();
      res.json(rows);
    } catch (error) {
      res.status(500).json({ message: 'Чөлөөний хүсэлтүүдийг авахад алдаа гарлаа.', error: error.message });
    }
  }

  static async review(req, res) {
    try {
      const reviewerId = req.employee.id;
      const { id } = req.params;
      const { status, manager_note } = req.body;

      if (!['approved', 'rejected'].includes(status)) {
        return res.status(400).json({ message: 'Шийдвэр зөвхөн "approved" эсвэл "rejected" байна.' });
      }

      const row = await LeaveRequest.review(id, reviewerId, status, manager_note);
      if (!row) {
        return res.status(404).json({ message: 'Чөлөөний хүсэлт олдсонгүй.' });
      }

      res.json({ message: 'Чөлөөний хүсэлтийн шийдвэр шинэчлэгдлээ.', data: row });
    } catch (error) {
      res.status(500).json({ message: 'Чөлөөний хүсэлт шийдвэрлэхэд алдаа гарлаа.', error: error.message });
    }
  }

  static async reschedule(req, res) {
    try {
      const reviewerId = req.employee.id;
      const { id } = req.params;
      const { leave_date, manager_note } = req.body;
      const normalizedDate = normalizeLeaveDate(leave_date);

      if (!normalizedDate) {
        return res.status(400).json({ message: 'Шилжүүлэх огноо буруу байна.' });
      }

      const row = await LeaveRequest.reschedule(id, reviewerId, normalizedDate, manager_note);
      if (!row) {
        return res.status(404).json({ message: 'Чөлөөний хүсэлт олдсонгүй.' });
      }

      res.json({ message: 'Хүсэлтийг шинэ огноо руу шилжүүллээ.', data: row });
    } catch (error) {
      res.status(500).json({ message: 'Чөлөө шилжүүлэхэд алдаа гарлаа.', error: error.message });
    }
  }
}

module.exports = LeaveController;

