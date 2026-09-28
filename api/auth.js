import { setCors, handleOptions } from './lib/cors.js';
import { login, verifyToken, auditLog, DEMO_USERS } from './lib/auth.js';

export default async function handler(req, res) {
  setCors(res);
  if (handleOptions(req, res)) return;

  try {
    if (req.method === 'GET') {
      return res.status(200).json({
        demo_accounts: Object.keys(DEMO_USERS).map((email) => ({
          email,
          role: DEMO_USERS[email].role,
          hint: 'See DEMO_GUIDE / README for passwords',
        })),
        watermark: 'Synthetic demonstration data. This application does not use or represent official government records.',
      });
    }

    if (req.method === 'POST') {
      const { action, email, password, token } = req.body || {};
      if (action === 'login') {
        const result = login(email, password);
        if (!result) return res.status(401).json({ error: 'Invalid credentials' });
        await auditLog('login', 'user', email, {}, result.user);
        return res.status(200).json(result);
      }
      if (action === 'me') {
        const user = verifyToken(token || req.headers.authorization?.replace(/^Bearer\s+/i, ''));
        if (!user) return res.status(401).json({ error: 'Invalid session' });
        return res.status(200).json({ user });
      }
      return res.status(400).json({ error: 'Unknown action' });
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
}
