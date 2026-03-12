const nodemailer = require('nodemailer');
require('dotenv').config();

class EmailService {
  constructor() {
    this.transporter = nodemailer.createTransport({
      service: process.env.EMAIL_SERVICE || 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD,
      },
    });
  }

  async sendCheckInNotification(employee) {
    try {
      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: employee.email,
        subject: `✓ Ажилд ирэх сүүлчлэл - ${new Date().toLocaleDateString('mn-MN')}`,
        html: `
          <h2>Ажилд ирсэн болно!</h2>
          <p>Сайн байна уу, <strong>${employee.first_name} ${employee.last_name}</strong></p>
          <p>Та ${new Date().toLocaleTimeString('mn-MN')} цагт ажилд ирсэн болно.</p>
          <p>Сайхан ажилтан байгаарай!</p>
        `,
      };

      await this.transporter.sendMail(mailOptions);
      console.log('Check-in email sent to:', employee.email);
    } catch (error) {
      console.error('Failed to send check-in email:', error);
    }
  }

  async sendCheckOutNotification(employee, hoursWorked) {
    try {
      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: employee.email,
        subject: `✗ Ажилаас гарах сүүлчлэл - ${new Date().toLocaleDateString('mn-MN')}`,
        html: `
          <h2>Ажилаас гарсан болно!</h2>
          <p>Сайн байна уу, <strong>${employee.first_name} ${employee.last_name}</strong></p>
          <p>Та ${new Date().toLocaleTimeString('mn-MN')} цагт ажилаас гарсан болно.</p>
          <p><strong>Ажилласан цаг:</strong> ${hoursWorked.toFixed(2)} цаг</p>
          <p>Өнөөдөр ажилдаа ирүүлсэнд баярлалаа!</p>
        `,
      };

      await this.transporter.sendMail(mailOptions);
      console.log('Check-out email sent to:', employee.email);
    } catch (error) {
      console.error('Failed to send check-out email:', error);
    }
  }

  async sendTaskNotification(employee, task) {
    try {
      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: employee.email,
        subject: `📋 Шинэ ажил: ${task.title}`,
        html: `
          <h2>Шинэ ажил өнөөцөлсөн!</h2>
          <p>Сайн байна уу, <strong>${employee.first_name} ${employee.last_name}</strong></p>
          <h3>${task.title}</h3>
          <p>${task.description}</p>
          <p><strong>Чухалтай:</strong> ${task.priority}</p>
          <p><strong>Хугацаа:</strong> ${new Date(task.due_date).toLocaleDateString('mn-MN')}</p>
        `,
      };

      await this.transporter.sendMail(mailOptions);
      console.log('Task notification email sent to:', employee.email);
    } catch (error) {
      console.error('Failed to send task notification:', error);
    }
  }

  async sendDailyReport(employee, stats) {
    try {
      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: employee.email,
        subject: `📊 Өнөөдрийн ажлын тайлан - ${new Date().toLocaleDateString('mn-MN')}`,
        html: `
          <h2>Өнөөдрийн ажлын тайлан</h2>
          <p>Сайн байна уу, <strong>${employee.first_name} ${employee.last_name}</strong></p>
          <ul>
            <li><strong>Ажилласан цаг:</strong> ${stats.hoursWorked.toFixed(2)} цаг</li>
            <li><strong>Дуусгасан ажлууд:</strong> ${stats.completedTasks}</li>
            <li><strong>Үлдсэн ажлууд:</strong> ${stats.pendingTasks}</li>
            <li><strong>Уулзалтууд:</strong> ${stats.meetings}</li>
          </ul>
        `,
      };

      await this.transporter.sendMail(mailOptions);
      console.log('Daily report email sent to:', employee.email);
    } catch (error) {
      console.error('Failed to send daily report:', error);
    }
  }
}

module.exports = new EmailService();
