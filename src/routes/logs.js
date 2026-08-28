const express = require('express');
const { systemLogs, swarmLogs, makeLog } = require('../data/store');
const { requireAuth } = require('../middleware/auth');
const { broadcast } = require('../ws/broadcaster');

const router = express.Router();

/**
 * GET /api/logs/system
 * Returns system-level operation logs.
 * Query params:
 *   limit  — max entries to return (default 50)
 *   level  — filter by log level (SYS, WRN, CRIT, AI, SEC, MED, TRN, COM, FAC)
 */
router.get('/system', requireAuth, (req, res) => {
  const limit = parseInt(req.query.limit) || 50;
  const { level } = req.query;

  let result = [...systemLogs];
  if (level) result = result.filter((l) => l.level === level.toUpperCase());

  res.json(result.slice(0, limit));
});

/**
 * GET /api/logs/swarm
 * Returns the AI agent swarm activity log stream.
 * Query params:
 *   limit  — max entries (default 50)
 *   level  — filter by log level
 */
router.get('/swarm', requireAuth, (req, res) => {
  const limit = parseInt(req.query.limit) || 50;
  const { level } = req.query;

  let result = [...swarmLogs];
  if (level) result = result.filter((l) => l.level === level.toUpperCase());

  res.json(result.slice(0, limit));
});

/**
 * POST /api/logs/system
 * Manually inject a system log entry (e.g. from external sensor feeds).
 * Body: { level, message }
 */
router.post('/system', requireAuth, (req, res) => {
  const { level, message } = req.body;
  const validLevels = ['SYS', 'WRN', 'CRIT', 'AI', 'SEC', 'MED', 'TRN', 'COM', 'FAC'];

  if (!level || !message) {
    return res.status(400).json({ error: 'level and message are required.' });
  }
  if (!validLevels.includes(level.toUpperCase())) {
    return res.status(400).json({ error: `level must be one of: ${validLevels.join(', ')}` });
  }

  const log = makeLog(level.toUpperCase(), message);
  systemLogs.unshift(log);

  broadcast({ type: 'SYSTEM_LOG', payload: log });

  res.status(201).json(log);
});

/**
 * POST /api/logs/swarm
 * Inject a swarm log entry.
 * Body: { level, message }
 */
router.post('/swarm', requireAuth, (req, res) => {
  const { level, message } = req.body;
  const validLevels = ['SYS', 'WRN', 'CRIT', 'AI', 'SEC', 'MED', 'TRN', 'COM', 'FAC'];

  if (!level || !message) {
    return res.status(400).json({ error: 'level and message are required.' });
  }
  if (!validLevels.includes(level.toUpperCase())) {
    return res.status(400).json({ error: `level must be one of: ${validLevels.join(', ')}` });
  }

  const log = makeLog(level.toUpperCase(), message);
  swarmLogs.unshift(log);

  broadcast({ type: 'SWARM_LOG', payload: log });

  res.status(201).json(log);
});

module.exports = router;
