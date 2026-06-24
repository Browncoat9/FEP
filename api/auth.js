function parseCookies(cookieHeader) {
  const cookies = {};
  if (!cookieHeader) return cookies;
  cookieHeader.split(';').forEach(pair => {
    const [key, ...rest] = pair.trim().split('=');
    if (key) cookies[key.trim()] = decodeURIComponent(rest.join('=').trim());
  });
  return cookies;
}

// Sanitize project name to only allow alphanumeric and hyphens
function sanitizeProject(project) {
  if (typeof project !== 'string') return null;
  const cleaned = project.replace(/[^a-zA-Z0-9-]/g, '').toLowerCase();
  return cleaned.length > 0 && cleaned.length <= 50 ? cleaned : null;
}

module.exports = async function handler(req, res) {

  // ── GET: check if current request is authenticated for a project ──
  if (req.method === 'GET') {
    const project = sanitizeProject(req.query.project);
    if (!project) {
      return res.status(400).json({ authenticated: false, error: 'Invalid project.' });
    }

    const envKey = `PASSWORD_${project.toUpperCase().replace(/-/g, '_')}`;
    const correctPassword = process.env[envKey];

    // If no password is set for this project, it's not protected
    if (!correctPassword) {
      return res.status(200).json({ authenticated: true });
    }

    const cookies = parseCookies(req.headers.cookie);
    const token = cookies[`auth_${project}`];
    const authenticated = token === correctPassword;

    return res.status(200).json({ authenticated });
  }

  // ── POST: log in with a password ──
  if (req.method === 'POST') {
    const contentType = req.headers['content-type'] || '';
    if (!contentType.includes('application/json')) {
      return res.status(400).json({ error: 'Invalid request format.' });
    }

    const project = sanitizeProject(req.body?.project);
    const { password } = req.body || {};

    if (!project) {
      return res.status(400).json({ error: 'Invalid project.' });
    }

    if (!password || typeof password !== 'string') {
      return res.status(400).json({ error: 'Password is required.' });
    }

    const envKey = `PASSWORD_${project.toUpperCase().replace(/-/g, '_')}`;
    const correctPassword = process.env[envKey];

    if (!correctPassword) {
      return res.status(404).json({ error: 'This project is not password protected.' });
    }

    if (password !== correctPassword) {
      // Small delay to slow down brute force attempts
      await new Promise(r => setTimeout(r, 500));
      return res.status(401).json({ error: 'Incorrect password.' });
    }

    // Set httpOnly cookie — expires in 7 days
    const cookieName = `auth_${project}`;
    const maxAge = 7 * 24 * 60 * 60;
    res.setHeader('Set-Cookie',
      `${cookieName}=${correctPassword}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${maxAge}`
    );

    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
