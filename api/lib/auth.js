import supabase from '../db-client.js';
import crypto from 'crypto';

const DEMO_USERS = {
  'admin@verity-x.demo': { password: 'verity-admin-2024', role: 'ADMIN', name: 'Demo Admin' },
  'investigator@verity-x.demo': { password: 'verity-inv-2024', role: 'INVESTIGATOR', name: 'Demo Investigator' },
  'reviewer@verity-x.demo': { password: 'verity-rev-2024', role: 'REVIEWER', name: 'Demo Reviewer' },
  'viewer@verity-x.demo': { password: 'verity-view-2024', role: 'VIEWER', name: 'Demo Viewer' },
};

function hashPassword(password, salt = 'verity-x-synthetic-salt') {
  return crypto.createHmac('sha256', salt).update(password).digest('hex');
}

function signToken(payload) {
  const body = Buffer.from(JSON.stringify({ ...payload, exp: Date.now() + 86400000 * 7 })).toString('base64url');
  const sig = crypto.createHmac('sha256', process.env.SUPABASE_SERVICE_ROLE_KEY || 'verity-dev').update(body).digest('base64url');
  return `${body}.${sig}`;
}

export function verifyToken(token) {
  if (!token) return null;
  const [body, sig] = token.split('.');
  if (!body || !sig) return null;
  const expected = crypto.createHmac('sha256', process.env.SUPABASE_SERVICE_ROLE_KEY || 'verity-dev').update(body).digest('base64url');
  if (sig !== expected) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString());
    if (payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

export function login(email, password) {
  const user = DEMO_USERS[email?.toLowerCase()];
  if (!user || user.password !== password) return null;
  const token = signToken({ email: email.toLowerCase(), role: user.role, name: user.name });
  return { token, user: { email: email.toLowerCase(), role: user.role, name: user.name } };
}

export function requireAuth(req, res, roles = null) {
  const header = req.headers.authorization || '';
  const token = header.replace(/^Bearer\s+/i, '');
  const user = verifyToken(token);
  if (!user) {
    res.status(401).json({ error: 'Unauthorized', human_review_required: true });
    return null;
  }
  if (roles && !roles.includes(user.role)) {
    res.status(403).json({ error: 'Forbidden for role', role: user.role });
    return null;
  }
  return user;
}

export async function auditLog(action, entity_type, entity_id, details, user) {
  try {
    await supabase.from('vx_audit_logs').insert({
      user_email: user?.email || 'system',
      user_role: user?.role || 'SYSTEM',
      action,
      entity_type,
      entity_id: entity_id != null ? String(entity_id) : null,
      details: details || {},
      synthetic_watermark: true,
    });
  } catch (e) {
    console.error('audit log failed', e.message);
  }
}

export { hashPassword, DEMO_USERS, signToken };
