const { kv } = require('@vercel/kv');

const DB_KEY = 'vv_db';

async function readDB() {
  const data = await kv.get(DB_KEY);
  return data || { bookings: [], blockedDates: [], nextId: 1 };
}

async function writeDB(data) {
  await kv.set(DB_KEY, data);
}

const db = {
  async insertBooking(booking) {
    const data = await readDB();
    const newBooking = {
      id: data.nextId++,
      ...booking,
      status: 'pending',
      createdAt: new Date().toLocaleString('en-GB'),
    };
    data.bookings.push(newBooking);
    await writeDB(data);
    return newBooking;
  },

  async getBookings({ status, date, search } = {}) {
    const data = await readDB();
    let results = data.bookings;
    if (status && status !== 'all') results = results.filter(b => b.status === status);
    if (date) results = results.filter(b => b.date === date);
    if (search) {
      const s = search.toLowerCase();
      results = results.filter(b =>
        `${b.firstName} ${b.lastName}`.toLowerCase().includes(s) ||
        b.email.toLowerCase().includes(s) ||
        b.phone.includes(s)
      );
    }
    return results.sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));
  },

  async getBookingById(id) {
    const data = await readDB();
    return data.bookings.find(b => b.id === Number(id));
  },

  async updateBookingStatus(id, status) {
    const data = await readDB();
    const booking = data.bookings.find(b => b.id === Number(id));
    if (!booking) return false;
    booking.status = status;
    await writeDB(data);
    return true;
  },

  async deleteBooking(id) {
    const data = await readDB();
    data.bookings = data.bookings.filter(b => b.id !== Number(id));
    await writeDB(data);
  },

  async getBlockedDates() {
    const data = await readDB();
    return data.blockedDates.map(d => d.date);
  },

  async blockDate(date, reason) {
    const data = await readDB();
    data.blockedDates = data.blockedDates.filter(d => d.date !== date);
    data.blockedDates.push({ date, reason: reason || '' });
    await writeDB(data);
  },

  async unblockDate(date) {
    const data = await readDB();
    data.blockedDates = data.blockedDates.filter(d => d.date !== date);
    await writeDB(data);
  },

  async getStats() {
    const data = await readDB();
    const today = new Date().toISOString().split('T')[0];
    return {
      total:     data.bookings.length,
      pending:   data.bookings.filter(b => b.status === 'pending').length,
      confirmed: data.bookings.filter(b => b.status === 'confirmed').length,
      declined:  data.bookings.filter(b => b.status === 'declined').length,
      today:     data.bookings.filter(b => b.date === today).length,
    };
  },

  async isDateBlocked(date) {
    const data = await readDB();
    return data.blockedDates.some(d => d.date === date);
  },
};

module.exports = { db };
