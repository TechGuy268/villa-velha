const { db } = require('../_db');
const { sendCustomerConfirmation, sendAdminNotification } = require('../_email');
const { setCors, adminAuth } = require('../_auth');

module.exports = async (req, res) => {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  // POST /api/bookings — public
  if (req.method === 'POST') {
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

  // GET /api/bookings — admin only
  if (req.method === 'GET') {
    if (!adminAuth(req, res)) return;
    const { status, date, search } = req.query;
    return res.json(await db.getBookings({ status, date, search }));
  }

  res.status(405).json({ error: 'Method not allowed' });
};
