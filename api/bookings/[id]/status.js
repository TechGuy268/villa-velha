const { db } = require('../../_db');
const { sendStatusEmail } = require('../../_email');
const { setCors, adminAuth } = require('../../_auth');

module.exports = async (req, res) => {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'PATCH') return res.status(405).json({ error: 'Method not allowed' });
  if (!adminAuth(req, res)) return;

  const { id } = req.query;
  const { status } = req.body;

  if (!['confirmed', 'declined', 'pending'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }

  const booking = await db.getBookingById(id);
  if (!booking) return res.status(404).json({ error: 'Booking not found' });

  await db.updateBookingStatus(id, status);

  try {
    await sendStatusEmail(booking, status);
  } catch (err) {
    console.error('Email error:', err.message);
  }

  res.json({ success: true });
};
