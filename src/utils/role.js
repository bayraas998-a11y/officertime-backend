const normalizeRole = (value) => {
  const raw = String(value || '').trim().toLowerCase();
  if (!raw) return 'employee';

  // Admin: full access
  if (raw === 'admin' || raw === 'superadmin') return 'admin';

  // Director/Manager: company-level info + manage tasks/requests (no employee create)
  if (
    raw === 'director' ||
    raw === 'zahiral' ||
    raw.includes('захирал') ||
    raw.includes('директор') ||
    raw === 'manager' ||
    raw === 'darga' ||
    raw.includes('дарга') ||
    raw === 'senior' ||
    raw === 'ahlah' ||
    raw.includes('ахлах')
  ) {
    return 'director';
  }

  return 'employee';
};

const isAdminRole = (role) => normalizeRole(role) === 'admin';
const isLeaderRole = (role) => ['admin', 'director'].includes(normalizeRole(role));

module.exports = {
  normalizeRole,
  isAdminRole,
  isLeaderRole,
};

