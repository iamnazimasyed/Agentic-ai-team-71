const express = require('express');
const { directives, systemLogs, makeLog } = require('../data/store');
const { requireAuth } = require('../middleware/auth');
const { broadcast } = require('../ws/broadcaster');

const router = express.Router();

/**
 * GET /api/directives
 * Query params: status — PENDING | APPROVED | REJECTED | MODIFIED
 */
router.get('/', requireAuth, (req, res) => {
  const { status } = req.query;
  let result = [...directives];
  if (status) result = result.filter((d) => d.status === status.toUpperCase());
  res.json(result);
});

/**
 * GET /api/directives/:id
 */
router.get('/:id', requireAuth, (req, res) => {
  const directive = directives.find((d) => d.id === req.params.id);
  if (!directive) return res.status(404).json({ error: 'Directive not found.' });
  res.json(directive);
});

/**
 * POST /api/directives
 * Create a new AI-generated directive (typically called by AI agent logic).
 * Body: { incidentId, title, risk, confidence, justification, recommendedActions }
 */
router.post('/', requireAuth, (req, res) => {
  const { incidentId, title, risk, confidence, justification, recommendedActions } = req.body;

  if (!incidentId || !title || !risk || confidence == null || !justification) {
    return res.status(400).json({
      error: 'incidentId, title, risk, confidence, and justification are required.',
    });
  }

  const validRisks = ['HIGH', 'MED', 'LOW'];
  if (!validRisks.includes(risk)) {
    return res.status(400).json({ error: `risk must be one of: ${validRisks.join(', ')}` });
  }

  const id = `${incidentId}-${String(Date.now()).slice(-4)}`;
  const now = new Date().toUTCString().replace('GMT', 'UTC');

  const newDirective = {
    id,
    incidentId,
    title,
    risk,
    timestamp: now,
    confidence: parseFloat(confidence),
    justification,
    recommendedActions: recommendedActions || [],
    status: 'PENDING',
    signedBy: null,
  };

  directives.unshift(newDirective);

  const log = makeLog('AI', `New directive ${id} ("${title}") generated. Risk: ${risk}. Awaiting commander review.`);
  systemLogs.unshift(log);

  broadcast({ type: 'DIRECTIVE_CREATED', payload: newDirective });
  broadcast({ type: 'SYSTEM_LOG', payload: log });

  res.status(201).json(newDirective);
});

/**
 * PATCH /api/directives/:id/approve
 * Commander signs and authorizes the directive.
 */
router.patch('/:id/approve', requireAuth, (req, res) => {
  const directive = directives.find((d) => d.id === req.params.id);
  if (!directive) return res.status(404).json({ error: 'Directive not found.' });
  if (directive.status !== 'PENDING') {
    return res.status(400).json({ error: 'Only PENDING directives can be approved.' });
  }

  directive.status = 'APPROVED';
  directive.signedBy = `SIG: ${req.officer.name.toUpperCase()} (${req.officer.id})`;

  const log = makeLog(
    'AI',
    `${req.officer.name} signed and authorized directive ${directive.id}.`
  );
  systemLogs.unshift(log);

  broadcast({ type: 'DIRECTIVE_UPDATED', payload: directive });
  broadcast({ type: 'SYSTEM_LOG', payload: log });

  res.json({ message: 'Directive approved.', directive });
});

/**
 * PATCH /api/directives/:id/reject
 * Commander rejects the directive.
 */
router.patch('/:id/reject', requireAuth, (req, res) => {
  const directive = directives.find((d) => d.id === req.params.id);
  if (!directive) return res.status(404).json({ error: 'Directive not found.' });
  if (directive.status !== 'PENDING') {
    return res.status(400).json({ error: 'Only PENDING directives can be rejected.' });
  }

  directive.status = 'REJECTED';
  directive.signedBy = `SIG: ${req.officer.name.toUpperCase()} (${req.officer.id})`;

  const log = makeLog(
    'WRN',
    `Directive ${directive.id} was rejected by ${req.officer.name}.`
  );
  systemLogs.unshift(log);

  broadcast({ type: 'DIRECTIVE_UPDATED', payload: directive });
  broadcast({ type: 'SYSTEM_LOG', payload: log });

  res.json({ message: 'Directive rejected.', directive });
});

/**
 * PATCH /api/directives/:id/modify
 * Commander amends the directive with revised parameters.
 * Body: { amendment: string }
 */
router.patch('/:id/modify', requireAuth, (req, res) => {
  const { amendment } = req.body;
  if (!amendment) return res.status(400).json({ error: 'amendment text is required.' });

  const directive = directives.find((d) => d.id === req.params.id);
  if (!directive) return res.status(404).json({ error: 'Directive not found.' });
  if (directive.status !== 'PENDING') {
    return res.status(400).json({ error: 'Only PENDING directives can be modified.' });
  }

  directive.status = 'MODIFIED';
  directive.justification = `${directive.justification} [AMENDMENT: ${amendment}]`;
  directive.signedBy = `SIG: ${req.officer.name.toUpperCase()} (${req.officer.id}) (AMENDED)`;

  const log = makeLog(
    'AI',
    `Directive ${directive.id} amended by ${req.officer.name}: "${amendment}"`
  );
  systemLogs.unshift(log);

  broadcast({ type: 'DIRECTIVE_UPDATED', payload: directive });
  broadcast({ type: 'SYSTEM_LOG', payload: log });

  res.json({ message: 'Directive modified.', directive });
});

module.exports = router;
