const express = require('express');
const bcrypt = require('bcryptjs');
const { officers } = require('../data/store');
const { signToken } = require('../middleware/auth');

const router = express.Router();

/**
 * POST /api/auth/login
 * Body: { officerId: string, password: string }
 * Returns: { token, officer: { id, name, role } }
 *
 * For the demo any password is accepted — the bcrypt check is bypassed
 * when DEMO_MODE=true (default). Set DEMO_MODE=false to enforce real hashes.
 */
router.post('/login', async (req, res) => {
  const { officerId, password } = req.body;

  if (!officerId || !password) {
    return res.status(400).json({ error: 'officerId and password are required.' });
  }

  const officer = officers.find((o) => o.id === officerId);

  if (!officer) {
    return res.status(401).json({ error: 'Invalid credentials.' });
  }

  const demoMode = process.env.DEMO_MODE !== 'false';

  if (!demoMode) {
    const valid = await bcrypt.compare(password, officer.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid credentials.' });
    }
  }

  const token = signToken({ id: officer.id, name: officer.name, role: officer.role });

  return res.json({
    token,
    officer: { id: officer.id, name: officer.name, role: officer.role },
  });
});

/**
 * GET /api/auth/me
 * Returns the currently authenticated officer's profile.
 */
router.get('/me', require('../middleware/auth').requireAuth, (req, res) => {
  res.json({ officer: req.officer });
});

module.exports = router;
