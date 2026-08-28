const express = require('express');
const { systemLogs, makeLog } = require('../data/store');
const { requireAuth } = require('../middleware/auth');
const { broadcast } = require('../ws/broadcaster');

const router = express.Router();

// Track lockdown state in-process
let lockdownActive = false;
let lockdownRecord = null;

/**
 * GET /api/lockdown/status
 * Returns the current campus lockdown state.
 */
router.get('/status', requireAuth, (req, res) => {
  res.json({ active: lockdownActive, record: lockdownRecord });
});

/**
 * POST /api/lockdown/engage
 * Engages campus-wide (or sector-specific) emergency lockdown.
 * Body: { authToken, sectors?, notes? }
 *   authToken — commander PIN / token (validated for format; real auth via JWT)
 *   sectors   — array of sector names, defaults to ['ALL']
 *   notes     — optional reason string
 */
router.post('/engage', requireAuth, (req, res) => {
  const { authToken, sectors, notes } = req.body;

  if (!authToken) {
    return res.status(400).json({ error: 'authToken (commander PIN) is required.' });
  }

  const activeSectors = sectors && sectors.length > 0 ? sectors : ['ALL CAMPUS SECTORS'];

  lockdownActive = true;
  lockdownRecord = {
    engagedAt: new Date().toISOString(),
    engagedBy: req.officer.name,
    officerId: req.officer.id,
    sectors: activeSectors,
    notes: notes || '',
  };

  const log = makeLog(
    'CRIT',
    `EMERGENCY LOCKDOWN ENGAGED ACROSS ${activeSectors.join(', ')} BY ${req.officer.name.toUpperCase()}. ALL GATES SECURED.`
  );
  systemLogs.unshift(log);

  // Broadcast the critical event to all WebSocket clients
  broadcast({
    type: 'LOCKDOWN_ENGAGED',
    payload: { lockdown: lockdownRecord },
  });
  broadcast({ type: 'SYSTEM_LOG', payload: log });

  res.status(200).json({
    message: 'Emergency lockdown engaged.',
    lockdown: lockdownRecord,
  });
});

/**
 * POST /api/lockdown/disengage
 * Lifts the campus lockdown (requires auth).
 * Body: { authToken, reason? }
 */
router.post('/disengage', requireAuth, (req, res) => {
  const { authToken, reason } = req.body;

  if (!authToken) {
    return res.status(400).json({ error: 'authToken is required to disengage lockdown.' });
  }
  if (!lockdownActive) {
    return res.status(400).json({ error: 'No active lockdown to disengage.' });
  }

  lockdownActive = false;
  const disengagedRecord = { ...lockdownRecord, disengagedAt: new Date().toISOString(), disengagedBy: req.officer.name, reason: reason || '' };
  lockdownRecord = null;

  const log = makeLog(
    'SYS',
    `Lockdown disengaged by ${req.officer.name}. Reason: ${reason || 'Not specified'}.`
  );
  systemLogs.unshift(log);

  broadcast({ type: 'LOCKDOWN_DISENGAGED', payload: disengagedRecord });
  broadcast({ type: 'SYSTEM_LOG', payload: log });

  res.json({ message: 'Lockdown disengaged.', record: disengagedRecord });
});

module.exports = router;
