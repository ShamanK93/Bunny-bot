export function adminAuth(req, res, next) {
  const header = req.header('authorization') || '';
  const token = header.replace(/^Bearer\s+/i, '');

  if (!process.env.ADMIN_TOKEN) {
    return res.status(500).json({
      error: 'server_misconfigured',
      message: 'ADMIN_TOKEN manquant dans .env',
    });
  }

  if (token !== process.env.ADMIN_TOKEN) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  next();
}
