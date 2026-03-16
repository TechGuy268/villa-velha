require('dotenv').config();
const express    = require('express');
const Database = require('better-sqlite3');
const nodemailer = require('nodemailer');
const path       = require('path');
const cors       = require('cors');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Database setup ────────────────────────────────────────────────────────────
const db = new Database('bookings.db');

db.exec(`
  CREATE TABLE IF NOT EXISTS bookings (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    firstName   TEXT NOT NULL,
    lastName    TEXT NOT NULL,
    email       TEXT NOT NULL,
    phone       TEXT NOT NULL,
    date        TEXT NOT NULL,
    time        TEXT NOT NULL,
    guests      TEXT NOT NULL,
    occasion    TEXT DEFAULT '',
    dietary     TEXT DEFAULT '',
    notes       TEXT DEFAULT '',
    status      TEXT DEFAULT 'pending',
    createdAt   TEXT DEFAULT (datetime('now','localtime'))
  );

  CREATE TABLE IF NOT EXISTS blocked_dates (
    date   TEXT PRIMARY KEY,
    reason TEXT DEFAULT ''
  );
`);

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// ── Admin auth middleware ─────────────────────────────────────────────────────
function adminAuth(req, res, next) {
  const token = req.headers['x-admin-token'];
  if (token && token === process.env.ADMIN_TOKEN) return next();
  res.status(401).json({ error: 'Unauthorized' });
}

// ─────────────────────────────────────────────────────────────────────────────
// ROUTES
// ─────────────────────────────────────────────────────────────────────────────

// POST /api/admin/login
app.post('/api/admin/login', (req, res) => {
  const { password } = req.body;
  if (!password) return res.status(400).json({ error: 'Password required' });

  if (password === process.env.ADMIN_PASSWORD) {
    return res.json({ token: process.env.ADMIN_TOKEN });
  }
  res.status(401).json({ error: 'Invalid password' });
});

// POST /api/bookings — public, submit a new booking
app.post('/api/bookings', async (req, res) => {
  const { firstName, lastName, email, phone, date, time, guests, occasion, dietary, notes } = req.body;

  // Validate required fields
  if (!firstName || !lastName || !email || !phone || !date || !time || !guests) {
    return res.status(400).json({ error: 'Please fill in all required fields.' });
  }

  // Check blocked dates
  const blocked = db.prepare('SELECT * FROM blocked_dates WHERE date = ?').get(date);
  if (blocked) {
    return res.status(400).json({ error: 'Sorry, this date is unavailable. Please choose another date.' });
  }

  // Save to DB
  const stmt = db.prepare(`
    INSERT INTO bookings (firstName, lastName, email, phone, date, time, guests, occasion, dietary, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const result = stmt.run(firstName, lastName, email, phone, date, time, guests,
    occasion || '', dietary || '', notes || '');

  const bookingId = result.lastInsertRowid;

  // Send emails (don't block the response)
  try {
    await sendCustomerConfirmation({ firstName, lastName, email, date, time, guests, bookingId });
    await sendAdminNotification({ id: bookingId, firstName, lastName, email, phone, date, time, guests, occasion, dietary, notes });
  } catch (err) {
    console.error('Email error:', err.message);
  }

  res.json({ success: true, id: bookingId });
});

// GET /api/bookings — admin only
app.get('/api/bookings', adminAuth, (req, res) => {
  const { status, date, search } = req.query;
  let query = 'SELECT * FROM bookings';
  const conditions = [];
  const params = [];

  if (status && status !== 'all') { conditions.push('status = ?'); params.push(status); }
  if (date)   { conditions.push('date = ?'); params.push(date); }
  if (search) {
    conditions.push("(firstName || ' ' || lastName LIKE ? OR email LIKE ? OR phone LIKE ?)");
    const s = `%${search}%`;
    params.push(s, s, s);
  }

  if (conditions.length) query += ' WHERE ' + conditions.join(' AND ');
  query += ' ORDER BY date ASC, time ASC';

  const bookings = db.prepare(query).all(...params);
  res.json(bookings);
});

// GET /api/bookings/:id — admin only
app.get('/api/bookings/:id', adminAuth, (req, res) => {
  const booking = db.prepare('SELECT * FROM bookings WHERE id = ?').get(req.params.id);
  if (!booking) return res.status(404).json({ error: 'Booking not found' });
  res.json(booking);
});

// PATCH /api/bookings/:id/status — admin only
app.patch('/api/bookings/:id/status', adminAuth, async (req, res) => {
  const { status } = req.body;
  const { id } = req.params;

  if (!['confirmed', 'declined', 'pending'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }

  const booking = db.prepare('SELECT * FROM bookings WHERE id = ?').get(id);
  if (!booking) return res.status(404).json({ error: 'Booking not found' });

  db.prepare('UPDATE bookings SET status = ? WHERE id = ?').run(status, id);

  // Email customer
  try {
    await sendStatusEmail(booking, status);
  } catch (err) {
    console.error('Email error:', err.message);
  }

  res.json({ success: true });
});

// DELETE /api/bookings/:id — admin only
app.delete('/api/bookings/:id', adminAuth, (req, res) => {
  db.prepare('DELETE FROM bookings WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// GET /api/blocked-dates — public (frontend needs this to disable dates)
app.get('/api/blocked-dates', (req, res) => {
  const dates = db.prepare('SELECT date FROM blocked_dates').all().map(r => r.date);
  res.json(dates);
});

// POST /api/blocked-dates — admin only
app.post('/api/blocked-dates', adminAuth, (req, res) => {
  const { date, reason } = req.body;
  if (!date) return res.status(400).json({ error: 'Date required' });
  db.prepare('INSERT OR REPLACE INTO blocked_dates (date, reason) VALUES (?, ?)').run(date, reason || '');
  res.json({ success: true });
});

// DELETE /api/blocked-dates/:date — admin only
app.delete('/api/blocked-dates/:date', adminAuth, (req, res) => {
  db.prepare('DELETE FROM blocked_dates WHERE date = ?').run(req.params.date);
  res.json({ success: true });
});

// GET /api/stats — admin only
app.get('/api/stats', adminAuth, (req, res) => {
  const today = new Date().toISOString().split('T')[0];
  res.json({
    total:     db.prepare('SELECT COUNT(*) as c FROM bookings').get().c,
    pending:   db.prepare("SELECT COUNT(*) as c FROM bookings WHERE status = 'pending'").get().c,
    confirmed: db.prepare("SELECT COUNT(*) as c FROM bookings WHERE status = 'confirmed'").get().c,
    declined:  db.prepare("SELECT COUNT(*) as c FROM bookings WHERE status = 'declined'").get().c,
    today:     db.prepare('SELECT COUNT(*) as c FROM bookings WHERE date = ?').get(today).c,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// EMAIL HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function createTransporter() {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });
}

function formatDate(dateStr) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-GB', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });
}

async function sendCustomerConfirmation({ firstName, lastName, email, date, time, guests, bookingId }) {
  const transporter = createTransporter();
  const dateFormatted = formatDate(date);

  await transporter.sendMail({
    from: `"Villa Velha" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: 'Reservation Request Received — Villa Velha',
    html: `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#FDF8F9;font-family:Georgia,serif;">
  <div style="max-width:580px;margin:40px auto;background:#fff;border:1px solid #f0dde3;">

    <div style="background:#D4637A;padding:40px 40px 32px;text-align:center;">
      <h1 style="margin:0;font-family:Georgia,serif;font-size:32px;font-weight:400;color:#fff;letter-spacing:2px;">Villa Velha</h1>
      <p style="margin:8px 0 0;font-family:Arial,sans-serif;font-size:11px;letter-spacing:4px;text-transform:uppercase;color:rgba(255,255,255,0.8);">Alvor · Algarve · Portugal</p>
    </div>

    <div style="padding:44px 40px;">
      <p style="font-family:Arial,sans-serif;font-size:11px;letter-spacing:4px;text-transform:uppercase;color:#D4637A;margin:0 0 12px;">Reservation Request</p>
      <h2 style="margin:0 0 24px;font-size:28px;font-weight:400;color:#2C1520;">Thank you, ${firstName}!</h2>
      <p style="margin:0 0 24px;font-size:16px;line-height:1.7;color:#6A4050;">We have received your reservation request and will confirm it within 24 hours. Here's a summary of your booking:</p>

      <div style="background:#FAF0F3;border-left:3px solid #D4637A;padding:24px 28px;margin:28px 0;">
        <table style="width:100%;border-collapse:collapse;font-size:15px;color:#2C1520;">
          <tr><td style="padding:6px 0;color:#A08090;font-family:Arial,sans-serif;font-size:11px;letter-spacing:2px;text-transform:uppercase;width:140px;">Booking Ref</td><td style="padding:6px 0;font-weight:bold;color:#D4637A;">#VV${String(bookingId).padStart(4,'0')}</td></tr>
          <tr><td style="padding:6px 0;color:#A08090;font-family:Arial,sans-serif;font-size:11px;letter-spacing:2px;text-transform:uppercase;">Name</td><td style="padding:6px 0;">${firstName} ${lastName}</td></tr>
          <tr><td style="padding:6px 0;color:#A08090;font-family:Arial,sans-serif;font-size:11px;letter-spacing:2px;text-transform:uppercase;">Date</td><td style="padding:6px 0;">${dateFormatted}</td></tr>
          <tr><td style="padding:6px 0;color:#A08090;font-family:Arial,sans-serif;font-size:11px;letter-spacing:2px;text-transform:uppercase;">Time</td><td style="padding:6px 0;">${time}</td></tr>
          <tr><td style="padding:6px 0;color:#A08090;font-family:Arial,sans-serif;font-size:11px;letter-spacing:2px;text-transform:uppercase;">Guests</td><td style="padding:6px 0;">${guests}</td></tr>
        </table>
      </div>

      <p style="font-size:15px;line-height:1.7;color:#6A4050;">You will receive a confirmation email once your booking has been reviewed. If you need to make changes or have any questions, please contact us:</p>

      <p style="margin:20px 0;font-size:15px;color:#2C1520;">
        📞 <a href="tel:+531964399795" style="color:#D4637A;">+531 964 399 795</a><br>
        ✉️ <a href="mailto:villavelhaalvor@gmail.com" style="color:#D4637A;">villavelhaalvor@gmail.com</a>
      </p>

      <p style="font-size:15px;line-height:1.7;color:#6A4050;font-style:italic;">We look forward to welcoming you to Villa Velha.</p>
    </div>

    <div style="background:#2C1520;padding:24px 40px;text-align:center;">
      <p style="margin:0;font-family:Arial,sans-serif;font-size:11px;letter-spacing:2px;color:rgba(255,255,255,0.4);">R. Poe. João de Deus 13 · 8500-026 Alvor · Portugal</p>
    </div>
  </div>
</body>
</html>`,
  });
}

async function sendAdminNotification(booking) {
  const transporter = createTransporter();
  const dateFormatted = formatDate(booking.date);

  await transporter.sendMail({
    from: `"Villa Velha Bookings" <${process.env.EMAIL_USER}>`,
    to: process.env.ADMIN_EMAIL,
    subject: `🆕 New Reservation — ${booking.firstName} ${booking.lastName} · ${booking.date} ${booking.time}`,
    html: `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#FDF8F9;font-family:Georgia,serif;">
  <div style="max-width:580px;margin:40px auto;background:#fff;border:1px solid #f0dde3;">
    <div style="background:#2C1520;padding:28px 40px;text-align:center;">
      <h1 style="margin:0;font-family:Georgia,serif;font-size:22px;font-weight:400;color:#fff;">New Booking Request</h1>
      <p style="margin:6px 0 0;font-family:Arial,sans-serif;font-size:11px;letter-spacing:3px;text-transform:uppercase;color:#D4637A;">Villa Velha</p>
    </div>
    <div style="padding:36px 40px;">
      <table style="width:100%;border-collapse:collapse;font-size:15px;color:#2C1520;">
        <tr style="background:#FAF0F3;"><td style="padding:10px 14px;color:#A08090;font-family:Arial,sans-serif;font-size:11px;letter-spacing:2px;text-transform:uppercase;width:150px;">Booking Ref</td><td style="padding:10px 14px;font-weight:bold;color:#D4637A;">#VV${String(booking.id).padStart(4,'0')}</td></tr>
        <tr><td style="padding:10px 14px;color:#A08090;font-family:Arial,sans-serif;font-size:11px;letter-spacing:2px;text-transform:uppercase;">Guest</td><td style="padding:10px 14px;">${booking.firstName} ${booking.lastName}</td></tr>
        <tr style="background:#FAF0F3;"><td style="padding:10px 14px;color:#A08090;font-family:Arial,sans-serif;font-size:11px;letter-spacing:2px;text-transform:uppercase;">Email</td><td style="padding:10px 14px;"><a href="mailto:${booking.email}" style="color:#D4637A;">${booking.email}</a></td></tr>
        <tr><td style="padding:10px 14px;color:#A08090;font-family:Arial,sans-serif;font-size:11px;letter-spacing:2px;text-transform:uppercase;">Phone</td><td style="padding:10px 14px;">${booking.phone}</td></tr>
        <tr style="background:#FAF0F3;"><td style="padding:10px 14px;color:#A08090;font-family:Arial,sans-serif;font-size:11px;letter-spacing:2px;text-transform:uppercase;">Date</td><td style="padding:10px 14px;">${dateFormatted}</td></tr>
        <tr><td style="padding:10px 14px;color:#A08090;font-family:Arial,sans-serif;font-size:11px;letter-spacing:2px;text-transform:uppercase;">Time</td><td style="padding:10px 14px;">${booking.time}</td></tr>
        <tr style="background:#FAF0F3;"><td style="padding:10px 14px;color:#A08090;font-family:Arial,sans-serif;font-size:11px;letter-spacing:2px;text-transform:uppercase;">Guests</td><td style="padding:10px 14px;">${booking.guests}</td></tr>
        <tr><td style="padding:10px 14px;color:#A08090;font-family:Arial,sans-serif;font-size:11px;letter-spacing:2px;text-transform:uppercase;">Occasion</td><td style="padding:10px 14px;">${booking.occasion || '—'}</td></tr>
        <tr style="background:#FAF0F3;"><td style="padding:10px 14px;color:#A08090;font-family:Arial,sans-serif;font-size:11px;letter-spacing:2px;text-transform:uppercase;">Dietary</td><td style="padding:10px 14px;">${booking.dietary || '—'}</td></tr>
        <tr><td style="padding:10px 14px;color:#A08090;font-family:Arial,sans-serif;font-size:11px;letter-spacing:2px;text-transform:uppercase;">Notes</td><td style="padding:10px 14px;">${booking.notes || '—'}</td></tr>
      </table>
      <div style="margin-top:28px;text-align:center;">
        <a href="http://localhost:${process.env.PORT || 3000}/admin.html" style="display:inline-block;background:#D4637A;color:#fff;padding:14px 36px;font-family:Arial,sans-serif;font-size:12px;letter-spacing:3px;text-transform:uppercase;text-decoration:none;">View in Dashboard</a>
      </div>
    </div>
  </div>
</body>
</html>`,
  });
}

async function sendStatusEmail(booking, status) {
  const transporter = createTransporter();
  const dateFormatted = formatDate(booking.date);
  const isConfirmed = status === 'confirmed';

  await transporter.sendMail({
    from: `"Villa Velha" <${process.env.EMAIL_USER}>`,
    to: booking.email,
    subject: isConfirmed
      ? `✅ Reservation Confirmed — Villa Velha`
      : `Reservation Update — Villa Velha`,
    html: `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#FDF8F9;font-family:Georgia,serif;">
  <div style="max-width:580px;margin:40px auto;background:#fff;border:1px solid #f0dde3;">
    <div style="background:${isConfirmed ? '#D4637A' : '#8a8a8a'};padding:40px 40px 32px;text-align:center;">
      <h1 style="margin:0;font-family:Georgia,serif;font-size:32px;font-weight:400;color:#fff;letter-spacing:2px;">Villa Velha</h1>
      <p style="margin:8px 0 0;font-family:Arial,sans-serif;font-size:11px;letter-spacing:4px;text-transform:uppercase;color:rgba(255,255,255,0.8);">Alvor · Algarve · Portugal</p>
    </div>
    <div style="padding:44px 40px;">
      <div style="text-align:center;margin-bottom:28px;">
        <div style="display:inline-block;width:60px;height:60px;border-radius:50%;background:${isConfirmed ? '#FAF0F3' : '#f5f5f5'};border:1px solid ${isConfirmed ? '#D4637A' : '#ccc'};line-height:60px;font-size:26px;">${isConfirmed ? '✓' : '✕'}</div>
      </div>
      <h2 style="margin:0 0 16px;font-size:28px;font-weight:400;color:#2C1520;text-align:center;">
        ${isConfirmed ? 'Your reservation is confirmed!' : 'Reservation Update'}
      </h2>
      <p style="margin:0 0 24px;font-size:16px;line-height:1.7;color:#6A4050;text-align:center;">
        ${isConfirmed
          ? `We're delighted to confirm your table, ${booking.firstName}. We look forward to seeing you!`
          : `Dear ${booking.firstName}, unfortunately we are unable to accommodate your reservation at this time. We apologise for any inconvenience.`}
      </p>
      ${isConfirmed ? `
      <div style="background:#FAF0F3;border-left:3px solid #D4637A;padding:24px 28px;margin:28px 0;">
        <table style="width:100%;border-collapse:collapse;font-size:15px;color:#2C1520;">
          <tr><td style="padding:6px 0;color:#A08090;font-family:Arial,sans-serif;font-size:11px;letter-spacing:2px;text-transform:uppercase;width:140px;">Booking Ref</td><td style="padding:6px 0;font-weight:bold;color:#D4637A;">#VV${String(booking.id).padStart(4,'0')}</td></tr>
          <tr><td style="padding:6px 0;color:#A08090;font-family:Arial,sans-serif;font-size:11px;letter-spacing:2px;text-transform:uppercase;">Date</td><td style="padding:6px 0;">${dateFormatted}</td></tr>
          <tr><td style="padding:6px 0;color:#A08090;font-family:Arial,sans-serif;font-size:11px;letter-spacing:2px;text-transform:uppercase;">Time</td><td style="padding:6px 0;">${booking.time}</td></tr>
          <tr><td style="padding:6px 0;color:#A08090;font-family:Arial,sans-serif;font-size:11px;letter-spacing:2px;text-transform:uppercase;">Guests</td><td style="padding:6px 0;">${booking.guests}</td></tr>
        </table>
      </div>
      <p style="font-size:15px;line-height:1.7;color:#6A4050;">If you need to cancel or modify your reservation please contact us at least 24 hours in advance:</p>
      ` : `<p style="font-size:15px;line-height:1.7;color:#6A4050;text-align:center;">Please contact us to discuss alternative arrangements:</p>`}
      <p style="margin:20px 0;font-size:15px;color:#2C1520;text-align:center;">
        📞 <a href="tel:+531964399795" style="color:#D4637A;">+531 964 399 795</a><br>
        ✉️ <a href="mailto:villavelhaalvor@gmail.com" style="color:#D4637A;">villavelhaalvor@gmail.com</a>
      </p>
    </div>
    <div style="background:#2C1520;padding:24px 40px;text-align:center;">
      <p style="margin:0;font-family:Arial,sans-serif;font-size:11px;letter-spacing:2px;color:rgba(255,255,255,0.4);">R. Poe. João de Deus 13 · 8500-026 Alvor · Portugal</p>
    </div>
  </div>
</body>
</html>`,
  });
}

// ── Start server ──────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n  ✦ Villa Velha server running`);
  console.log(`  → Website:   http://localhost:${PORT}`);
  console.log(`  → Admin:     http://localhost:${PORT}/admin.html\n`);
});
