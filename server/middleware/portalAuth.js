import { getClientBySessionToken } from '../db.js';

export async function portalAuth(req, res, next) {
  const token = req.cookies?.bb_session;

  if (!token) {
    return res.status(401).json({ error: 'not_authenticated' });
  }

  const client = await getClientBySessionToken(token);

  if (!client) {
    res.clearCookie('bb_session');
    return res.status(401).json({ error: 'session_expired' });
  }

  req.client = client;
  req.sessionToken = token;
  next();
}
