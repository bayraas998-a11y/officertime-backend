// Demo attendance stats service
function getAttendanceStats(employeeId) {
  // Demo: daily stats
  return [
    { date: '2026-02-01', hoursWorked: 8, overtime: 2, expectedHours: 8 },
    { date: '2026-02-02', hoursWorked: 7, overtime: 0, expectedHours: 8 },
    { date: '2026-02-03', hoursWorked: 9, overtime: 1, expectedHours: 8 },
    { date: '2026-02-04', hoursWorked: 8, overtime: 0, expectedHours: 8 },
    { date: '2026-02-05', hoursWorked: 10, overtime: 2, expectedHours: 8 }
  ];
}

module.exports = { getAttendanceStats };
