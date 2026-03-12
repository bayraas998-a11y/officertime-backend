// Demo predictive analytics service

// ML-like logic: trend, anomaly, forecast, recommendation
function getPredictiveInsights(employeeId) {
  // Demo: employee attendance history, task completion, overtime
  // Normally, here you would use ML libraries (TensorFlow.js, sklearn, etc)
  // For demo, generate synthetic predictions

  // Example: attendance trend
  const attendanceHistory = [
    { week: '2026-01-01', attendance: 0.92 },
    { week: '2026-01-08', attendance: 0.88 },
    { week: '2026-01-15', attendance: 0.85 },
    { week: '2026-01-22', attendance: 0.87 },
    { week: '2026-01-29', attendance: 0.89 },
    { week: '2026-02-05', attendance: 0.91 }
  ];

  // Forecast: next week
  const forecastAttendance = `Дараа долоо хоногт багийн ирц ${(attendanceHistory[attendanceHistory.length-1].attendance*100).toFixed(1)}% байна.`;

  // Project completion
  const projectCompletion = 'Төслийн явцын хандлагаар дуусах хугацаа: 2026-03-01.';

  // Anomaly detection
  const anomaly = 'Сүүлийн 7 хоногт нэг ажилтан ирцийн гажуудалтай байна.';

  // Recommendations
  const recommendations = [
    'Ирцийн гажуудлыг анхаарч, багийн мотивацийг нэмэх.',
    'Төслийн дуусах хугацааг хянах, шаардлагатай бол нэмэлт нөөц гаргах.',
    'Илүү цагийг багасгах, ажлын ачааллыг тэнцвэржүүлэх.'
  ];

  // Return demo AI insights
  return {
    forecastAttendance,
    projectCompletion,
    anomaly,
    recommendations,
    attendanceTrend: attendanceHistory
  };
}

module.exports = { getPredictiveInsights };