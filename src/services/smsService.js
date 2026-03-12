const twilio = require('twilio');
require('dotenv').config();

const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

class SMSService {
  async sendCheckInAlert(phoneNumber, employeeName) {
    try {
      const message = await client.messages.create({
        body: `✓ Ажилд ирсэн болно! ${employeeName} - ${new Date().toLocaleTimeString('mn-MN')}`,
        from: process.env.TWILIO_PHONE_NUMBER,
        to: phoneNumber,
      });

      console.log('SMS sent:', message.sid);
      return message.sid;
    } catch (error) {
      console.error('Failed to send SMS:', error);
    }
  }

  async sendCheckOutAlert(phoneNumber, employeeName, hoursWorked) {
    try {
      const message = await client.messages.create({
        body: `✗ Ажилаас гарсан болно! ${employeeName} - ${hoursWorked.toFixed(2)}ц ${new Date().toLocaleTimeString('mn-MN')}`,
        from: process.env.TWILIO_PHONE_NUMBER,
        to: phoneNumber,
      });

      console.log('SMS sent:', message.sid);
      return message.sid;
    } catch (error) {
      console.error('Failed to send SMS:', error);
    }
  }

  async sendTaskAlert(phoneNumber, taskTitle) {
    try {
      const message = await client.messages.create({
        body: `📋 Шинэ ажил: ${taskTitle}`,
        from: process.env.TWILIO_PHONE_NUMBER,
        to: phoneNumber,
      });

      console.log('SMS sent:', message.sid);
      return message.sid;
    } catch (error) {
      console.error('Failed to send SMS:', error);
    }
  }

  async sendDeadlineAlert(phoneNumber, taskTitle, dueDate) {
    try {
      const message = await client.messages.create({
        body: `⏰ Сэтгэгдэл: "${taskTitle}" ажлын хугацаа ${dueDate} байна!`,
        from: process.env.TWILIO_PHONE_NUMBER,
        to: phoneNumber,
      });

      console.log('SMS sent:', message.sid);
      return message.sid;
    } catch (error) {
      console.error('Failed to send SMS:', error);
    }
  }
}

module.exports = new SMSService();
