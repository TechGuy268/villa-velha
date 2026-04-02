const { Resend } = require('resend');

function getResend() {
  return new Resend(process.env.RESEND_API_KEY);
}

function formatDate(dateStr) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-GB', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });
}

async function sendCustomerConfirmation({ id, firstName, lastName, email, date, time, guests }) {
  const resend = getResend();
  const dateFormatted = formatDate(date);
  const bookingId = id;

  await resend.emails.send({
    from: 'Villa Velha <reservations@villavelhaalvor.info>',
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
        📞 <a href="tel:+351964399795" style="color:#D4637A;">+351 964 399 795</a><br>
        ✉️ <a href="mailto:villavelha.ad@outlook.com" style="color:#D4637A;">villavelha.ad@outlook.com</a>
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
  const resend = getResend();
  const dateFormatted = formatDate(booking.date);

  await resend.emails.send({
    from: 'Villa Velha <reservations@villavelhaalvor.info>',
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
    </div>
  </div>
</body>
</html>`,
  });
}

async function sendStatusEmail(booking, status) {
  const resend = getResend();
  const dateFormatted = formatDate(booking.date);
  const isConfirmed = status === 'confirmed';

  await resend.emails.send({
    from: 'Villa Velha <reservations@villavelhaalvor.info>',
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
        📞 <a href="tel:+351964399795" style="color:#D4637A;">+351 964 399 795</a><br>
        ✉️ <a href="mailto:villavelha.ad@outlook.com" style="color:#D4637A;">villavelha.ad@outlook.com</a>
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

module.exports = { sendCustomerConfirmation, sendAdminNotification, sendStatusEmail };
