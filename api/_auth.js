function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-admin-token');
}

function adminAuth(req, res) {
  const token = req.headers['x-admin-token'];
  if (token && token === process.env.ADMIN_TOKEN) return true;
  res.status(401).json({ error: 'Unauthorized' });
  return false;
}

module.exports = { setCors, adminAuth };
