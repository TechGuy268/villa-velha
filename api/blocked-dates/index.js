const { db } = require('../_db');
const { setCors, adminAuth } = require('../_auth');

module.exports = async (req, res) => {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { action, date: queryDate } = req.query;

  // GET /api/blocked-dates — public
  if (req.method === 'GET') {
    return res.json(await db.getBlockedDates());
  }

  // POST /api/blocked-dates — block a date (admin)
  if (req.method === 'POST' && !action) {
    if (!adminAuth(req, res)) return;
    const { date, reason } = req.body;
    if (!date) return res.status(400).json({ error: 'Date required' });
    await db.blockDate(date, reason);
    return res.json({ success: true });
  }

  // POST /api/blocked-dates?action=unblock&date=2026-01-01 — unblock (admin)
  if (req.method === 'POST' && action === 'unblock' && queryDate) {
    if (!adminAuth(req, res)) return;
    await db.unblockDate(queryDate);
    return res.json({ success: true });
  }

  res.status(405).json({ error: 'Method not allowed' });
};
