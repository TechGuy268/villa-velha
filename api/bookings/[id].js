const { db } = require('../_db');
const { setCors, adminAuth } = require('../_auth');

module.exports = async (req, res) => {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (!adminAuth(req, res)) return;

  const { id } = req.query;

  // GET /api/bookings/:id
  if (req.method === 'GET') {
    const booking = await db.getBookingById(id);
    if (!booking) return res.status(404).json({ error: 'Booking not found' });
    return res.json(booking);
  }

  // DELETE /api/bookings/:id
  if (req.method === 'DELETE') {
    await db.deleteBooking(id);
    return res.json({ success: true });
  }

  res.status(405).json({ error: 'Method not allowed' });
};
