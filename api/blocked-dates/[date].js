const { db } = require('../_db');
const { setCors, adminAuth } = require('../_auth');

module.exports = async (req, res) => {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!adminAuth(req, res)) return;

  await db.unblockDate(req.query.date);
  res.json({ success: true });
};
