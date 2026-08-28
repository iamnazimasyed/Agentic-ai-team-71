const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { incidents, systemLogs, makeLog } = require('../data/store');
const { requireAuth } = require('../middleware/auth');
const { broadcast } = require('../ws/broadcaster');

const router = express.Router();

/**
 * GET /api/incidents
 * Query params:
 *   severity  — filter by CRITICAL | HIGH | MEDIUM | LOW
 *   status    — filter by Active | Monitoring | Resolved | Contained
 *   search    — free-text search across id, type, location, teams
 */
router.get('/', requireAuth, (req, res) => {
  const { severity, status, search } = req.query;
  let result = [...incidents];

  if (severity) result = result.filter((i) => i.severity === severity.toUpperCase());
  if (status) result = result.filter((i) => i.status === status);
  if (search) {
    const term = search.toLowerCase();
    result = result.filter(
      (i) =>
        i.id.toLowerCase().includes(term) ||
        i.type.toLowerCase().includes(term) ||
        i.location.toLowerCase().includes(term) ||
        i.teams.toLowerCase().includes(term)
    );
  }

  res.json(result);
});

/**
 * GET /api/incidents/:id
 */
router.get('/:id', requireAuth, (req, res) => {
  const incident = incidents.find((i) => i.id === req.params.id);
  if (!incident) return res.status(404).json({ error: 'Incident not found.' });
  res.json(incident);
});

/**
 * POST /api/incidents
 * Creates a new incident.
 * Body: { type, location, severity, teams, coordinates?, telemetry? }
 */
router.post('/', requireAuth, (req, res) => {
  const { type, location, severity, teams, coordinates, telemetry } = req.body;

  if (!type || !location || !severity || !teams) {
    return res.status(400).json({ error: 'type, location, severity, and teams are required.' });
  }

  const validSeverities = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];
  if (!validSeverities.includes(severity)) {
    return res.status(400).json({ error: `severity must be one of: ${validSeverities.join(', ')}` });
  }

  // Generate next incident ID based on current highest
  const lastId = incidents
    .map((i) => parseInt(i.id.replace('INC-', ''), 10))
    .filter((n) => !isNaN(n))
    .sort((a, b) => b - a)[0] || 1000;

  const newIncident = {
    id: `INC-${lastId + 1}`,
    type,
    location,
    severity,
    status: 'Active',
    reportedTime: new Date().toTimeString().split(' ')[0],
    teams,
    coordinates: coordinates || null,
    telemetry: telemetry || {
      tempZoneA: 'N/A',
      smokeDensity: '0%',
      sprinklers: 'Standby',
      evacStatus: 'Normal',
    },
  };

  incidents.unshift(newIncident);

  const log = makeLog('SYS', `New incident ${newIncident.id} (${type}) reported at ${location}.`);
  systemLogs.unshift(log);

  // Push real-time update to all WebSocket clients
  broadcast({ type: 'INCIDENT_CREATED', payload: newIncident });
  broadcast({ type: 'SYSTEM_LOG', payload: log });

  res.status(201).json(newIncident);
});

/**
 * PATCH /api/incidents/:id
 * Partially update an incident (status, severity, teams, telemetry, etc.)
 */
router.patch('/:id', requireAuth, (req, res) => {
  const idx = incidents.findIndex((i) => i.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Incident not found.' });

  const allowed = ['type', 'location', 'severity', 'status', 'teams', 'coordinates', 'telemetry'];
  const updates = {};
  for (const key of allowed) {
    if (req.body[key] !== undefined) updates[key] = req.body[key];
  }

  Object.assign(incidents[idx], updates);

  const log = makeLog(
    'SYS',
    `Incident ${incidents[idx].id} updated by ${req.officer.name}: ${JSON.stringify(updates)}`
  );
  systemLogs.unshift(log);

  broadcast({ type: 'INCIDENT_UPDATED', payload: incidents[idx] });
  broadcast({ type: 'SYSTEM_LOG', payload: log });

  res.json(incidents[idx]);
});

/**
 * DELETE /api/incidents/:id  (soft-delete → set status to Resolved)
 */
router.delete('/:id', requireAuth, (req, res) => {
  const incident = incidents.find((i) => i.id === req.params.id);
  if (!incident) return res.status(404).json({ error: 'Incident not found.' });

  incident.status = 'Resolved';

  const log = makeLog('SYS', `Incident ${incident.id} closed by ${req.officer.name}.`);
  systemLogs.unshift(log);

  broadcast({ type: 'INCIDENT_UPDATED', payload: incident });
  broadcast({ type: 'SYSTEM_LOG', payload: log });

  res.json({ message: 'Incident resolved.', incident });
});

module.exports = router;
