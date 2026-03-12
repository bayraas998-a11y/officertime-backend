const Meeting = require('../models/Meeting');

class MeetingController {
  static async getMeetings(req, res) {
    try {
      const employeeId = req.employee.id;
      const { startDate, endDate } = req.query;
      const meetings = await Meeting.getByEmployee(employeeId, startDate, endDate);
      res.json(meetings);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  static async createMeeting(req, res) {
    try {
      const employeeId = req.employee.id;
      const { title, description, meeting_date, duration_minutes, location, attendees } = req.body;
      const meeting = await Meeting.create(employeeId, { 
        title, 
        description, 
        meeting_date, 
        duration_minutes, 
        location, 
        attendees 
      });
      res.status(201).json(meeting);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  static async updateMeeting(req, res) {
    try {
      const { id } = req.params;
      const data = req.body;
      const meeting = await Meeting.update(id, data);
      res.json(meeting);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  static async deleteMeeting(req, res) {
    try {
      const { id } = req.params;
      await Meeting.delete(id);
      res.json({ message: 'Meeting deleted' });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
}

module.exports = MeetingController;
