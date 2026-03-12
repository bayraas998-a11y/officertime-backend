const { Expo } = require('expo-server-sdk');
require('dotenv').config();

const expo = new Expo({
  accessToken: process.env.EXPO_ACCESS_TOKEN,
});

class PushNotificationService {
  async sendCheckInNotification(pushToken, employeeName) {
    try {
      const messages = [{
        to: pushToken,
        sound: 'default',
        title: '✓ Ажилд ирсэн',
        body: `${employeeName} - ${new Date().toLocaleTimeString('mn-MN')}`,
        data: { type: 'check_in' },
      }];

      const tickets = await expo.sendPushNotificationsAsync(messages);
      console.log('Push notification sent:', tickets);
      return tickets;
    } catch (error) {
      console.error('Failed to send push notification:', error);
    }
  }

  async sendCheckOutNotification(pushToken, employeeName, hoursWorked) {
    try {
      const messages = [{
        to: pushToken,
        sound: 'default',
        title: '✗ Ажилаас гарсан',
        body: `${employeeName} - ${hoursWorked.toFixed(2)}ц`,
        data: { type: 'check_out', hours: hoursWorked },
      }];

      const tickets = await expo.sendPushNotificationsAsync(messages);
      console.log('Push notification sent:', tickets);
      return tickets;
    } catch (error) {
      console.error('Failed to send push notification:', error);
    }
  }

  async sendTaskNotification(pushToken, taskTitle, priority) {
    try {
      const messages = [{
        to: pushToken,
        sound: 'default',
        title: '📋 Шинэ ажил',
        body: taskTitle,
        data: { type: 'task', priority },
      }];

      const tickets = await expo.sendPushNotificationsAsync(messages);
      console.log('Push notification sent:', tickets);
      return tickets;
    } catch (error) {
      console.error('Failed to send push notification:', error);
    }
  }

  async sendMeetingReminder(pushToken, meetingTitle, meetingTime) {
    try {
      const messages = [{
        to: pushToken,
        sound: 'default',
        title: '👥 Уулзалтын сэтгэгдэл',
        body: `${meetingTitle} - ${meetingTime}`,
        data: { type: 'meeting' },
      }];

      const tickets = await expo.sendPushNotificationsAsync(messages);
      console.log('Push notification sent:', tickets);
      return tickets;
    } catch (error) {
      console.error('Failed to send push notification:', error);
    }
  }
}

module.exports = new PushNotificationService();
