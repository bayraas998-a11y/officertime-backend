const pool = require('../config/database');

const toNum = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

class SettingsController {
  static async getWorkplace(req, res) {
    try {
      const rows = await pool.query(
        `SELECT key, value
         FROM app_settings
         WHERE key IN ('workplace_lat', 'workplace_lng', 'workplace_radius_m')`
      );
      const map = {};
      for (const r of rows.rows || []) map[r.key] = r.value;

      const lat = toNum(map.workplace_lat);
      const lng = toNum(map.workplace_lng);
      const radiusM = toNum(map.workplace_radius_m) || 5;

      if (lat === null || lng === null) {
        return res.json({ enabled: false, workplace: null });
      }

      return res.json({
        enabled: true,
        workplace: { lat, lng, radius_m: radiusM },
      });
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  static async setWorkplace(req, res) {
    try {
      const { lat, lng, radius_m } = req.body || {};
      const latN = toNum(lat);
      const lngN = toNum(lng);
      const radiusN = toNum(radius_m) || 5;

      if (latN === null || lngN === null) {
        return res.status(400).json({ message: 'Ажлын байрны GPS координат буруу байна.' });
      }
      if (radiusN < 1 || radiusN > 200) {
        return res.status(400).json({ message: 'Радиус 1-200 метрийн хооронд байна.' });
      }

      const upsert = async (key, value) =>
        pool.run(
          'INSERT OR REPLACE INTO app_settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)',
          [key, String(value)]
        );

      await upsert('workplace_lat', latN);
      await upsert('workplace_lng', lngN);
      await upsert('workplace_radius_m', radiusN);

      return res.json({
        message: 'Ажлын байрны байршлыг амжилттай тохирууллаа.',
        enabled: true,
        workplace: { lat: latN, lng: lngN, radius_m: radiusN },
      });
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }
}

module.exports = SettingsController;

