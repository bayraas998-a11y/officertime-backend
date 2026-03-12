const toRad = (deg) => (Number(deg) * Math.PI) / 180;

// Haversine distance in meters.
const distanceMeters = (a, b) => {
  const lat1 = Number(a?.lat);
  const lon1 = Number(a?.lng);
  const lat2 = Number(b?.lat);
  const lon2 = Number(b?.lng);

  if (![lat1, lon1, lat2, lon2].every((n) => Number.isFinite(n))) return null;

  const R = 6371000; // meters
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const s1 = Math.sin(dLat / 2);
  const s2 = Math.sin(dLon / 2);
  const aa = s1 * s1 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * s2 * s2;
  const c = 2 * Math.atan2(Math.sqrt(aa), Math.sqrt(1 - aa));
  return R * c;
};

module.exports = {
  distanceMeters,
};

