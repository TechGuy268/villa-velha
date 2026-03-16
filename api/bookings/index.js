const { db } = require('../_db');
const { sendCustomerConfirmation, sendAdminNotification, sendStatusEmail } = require('../_email');
const { setCors, adminAuth } = require('../_auth');

module.exports = async (req, res) => {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { id, action } = req.query;

  // POST /api/bookings — create new booking (public)
  if (req.method === 'POST' && !id) {
    const { firstName, lastName, email, phone, date, time, guests, occasion, dietary, notes } = req.body;
    if (!firstName || !lastName || !email || !phone || !date || !time || !guests) {
      return res.status(400).json({ error: 'Please fill in all required fields.' });
    }
    if (await db.isDateBlocked(date)) {
      return res.status(400).json({ error: 'Sorry, this date is unavailable. Please choose another date.' });
    }
    const newBooking = await db.insertBooking({
      firstName, lastName, email, phone, date, time, guests,
      occasion: occasion || '', dietary: dietary || '', notes: notes || '',
    });
    try {
      await sendCustomerConfirmation(newBooking);
      await sendAdminNotification(newBooking);
    } catch (err) {
      console.error('Email error:', err.message);
    }
    return res.json({ success: true, id: newBooking.id });
  }

  // POST /api/bookings?id=1&action=status — update status (admin)
  if (req.method === 'POST' && id && action === 'status') {
    if (!adminAuth(req, res)) return;
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
    return res.json({ success: true });
  }

  // POST /api/bookings?id=1&action=delete — delete booking (admin)
  if (req.method === 'POST' && id && action === 'delete') {
    if (!adminAuth(req, res)) return;
    await db.deleteBooking(id);
    return res.json({ success: true });
  }

  // GET /api/bookings — list bookings (admin)
  if (req.method === 'GET') {
    if (!adminAuth(req, res)) return;
    const { status, date, search } = req.query;
    return res.json(await db.getBookings({ status, date, search }));
  }

  res.status(405).json({ error: 'Method not allowed' });
};
