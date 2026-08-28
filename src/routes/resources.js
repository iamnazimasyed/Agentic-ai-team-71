const express = require('express');
const { resources, systemLogs, makeLog } = require('../data/store');
const { requireAuth } = require('../middleware/auth');
const { broadcast } = require('../ws/broadcaster');

const router = express.Router();

const VALID_CATEGORIES = ['Ambulances', 'Security Teams', 'Medical Teams', 'Vehicles', 'Facilities', 'Shelters'];
const VALID_STATUSES = ['DEPLOYED', 'EN ROUTE', 'AVAILABLE', 'BUSY'];

/**
 * GET /api/resources
 * Query params: category, status, search
 */
router.get('/', requireAuth, (req, res) => {
  const { category, status, search } = req.query;
  let result = [...resources];

  if (category && category !== 'All Assets') {
    result = result.filter((r) => r.category === category);
  }
  if (status) {
    result = result.filter((r) => r.status === status.toUpperCase());
  }
  if (search) {
    const term = search.toLowerCase();
    result = result.filter(
      (r) =>
        r.id.toLowerCase().includes(term) ||
        r.type.toLowerCase().includes(term) ||
        r.location.toLowerCase().includes(term) ||
        r.assignedIncident.toLowerCase().includes(term)
    );
  }

  res.json(result);
});

/**
 * GET /api/resources/stats
 * Returns aggregate availability counts for the dashboard fleet overview.
 */
router.get('/stats', requireAuth, (req, res) => {
  const total = resources.length;
  const available = resources.filter((r) => r.status === 'AVAILABLE').length;
  const deployed = resources.filter((r) => r.status === 'DEPLOYED').length;
  const enRoute = resources.filter((r) => r.status === 'EN ROUTE').length;
  const busy = resources.filter((r) => r.status === 'BUSY').length;

  res.json({ total, available, deployed, enRoute, busy });
});

/**
 * GET /api/resources/:id
 */
router.get('/:id', requireAuth, (req, res) => {
  const resource = resources.find((r) => r.id === req.params.id);
  if (!resource) return res.status(404).json({ error: 'Resource not found.' });
  res.json(resource);
});

/**
 * POST /api/resources
 * Creates / registers a new resource (ad-hoc assign).
 * Body: { id?, type, category, location, status?, assignedIncident, distance?, operator? }
 */
router.post('/', requireAuth, (req, res) => {
  const { id, type, category, location, assignedIncident, distance, operator } = req.body;
  let { status } = req.body;

  if (!type || !category || !location) {
    return res.status(400).json({ error: 'type, category, and location are required.' });
  }
  if (!VALID_CATEGORIES.includes(category)) {
    return res.status(400).json({ error: `category must be one of: ${VALID_CATEGORIES.join(', ')}` });
  }

  status = status || 'AVAILABLE';
  if (!VALID_STATUSES.includes(status)) {
    return res.status(400).json({ error: `status must be one of: ${VALID_STATUSES.join(', ')}` });
  }

  const resourceId = id || `ADHOC-${Math.floor(100 + Math.random() * 900)}`;

  if (resources.find((r) => r.id === resourceId)) {
    return res.status(409).json({ error: `Resource with id ${resourceId} already exists.` });
  }

  const newResource = {
    id: resourceId,
    type,
    category,
    location,
    status,
    assignedIncident: assignedIncident || '--',
    distance: distance || 'N/A',
    operator: operator || null,
  };

  resources.unshift(newResource);

  const log = makeLog(
    'SYS',
    `Ad-hoc resource ${newResource.id} (${type}) assigned to ${location} by ${req.officer.name}.`
  );
  systemLogs.unshift(log);

  broadcast({ type: 'RESOURCE_CREATED', payload: newResource });
  broadcast({ type: 'SYSTEM_LOG', payload: log });

  res.status(201).json(newResource);
});

/**
 * PATCH /api/resources/:id
 * Update status, location, assignedIncident, etc.
 */
router.patch('/:id', requireAuth, (req, res) => {
  const idx = resources.findIndex((r) => r.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Resource not found.' });

  const allowed = ['type', 'category', 'location', 'status', 'assignedIncident', 'distance', 'operator'];
  const updates = {};
  for (const key of allowed) {
    if (req.body[key] !== undefined) updates[key] = req.body[key];
  }

  if (updates.status && !VALID_STATUSES.includes(updates.status)) {
    return res.status(400).json({ error: `status must be one of: ${VALID_STATUSES.join(', ')}` });
  }

  Object.assign(resources[idx], updates);

  const log = makeLog('SYS', `Resource ${resources[idx].id} updated by ${req.officer.name}.`);
  systemLogs.unshift(log);

  broadcast({ type: 'RESOURCE_UPDATED', payload: resources[idx] });
  broadcast({ type: 'SYSTEM_LOG', payload: log });

  res.json(resources[idx]);
});

/**
 * POST /api/resources/dispatch
 * Rapid dispatch — creates an EN ROUTE resource for a given unit type + destination.
 * Body: { unitType, destination, priority?, notes? }
 */
router.post('/dispatch', requireAuth, (req, res) => {
  const { unitType, destination, priority, notes } = req.body;

  if (!unitType || !destination) {
    return res.status(400).json({ error: 'unitType and destination are required.' });
  }

  const resourceId = `DSP-${Math.floor(100 + Math.random() * 900)}`;

  const newResource = {
    id: resourceId,
    type: unitType,
    category: 'Vehicles',
    location: destination,
    status: 'EN ROUTE',
    assignedIncident: 'INC-1024',
    distance: '0.1 km',
    operator: null,
    priority: priority || 'ROUTINE',
    notes: notes || '',
  };

  resources.unshift(newResource);

  const log = makeLog(
    'SYS',
    `Rapid dispatch order executed by ${req.officer.name}: ${unitType} → ${destination} [${priority || 'ROUTINE'}].`
  );
  systemLogs.unshift(log);

  broadcast({ type: 'RESOURCE_CREATED', payload: newResource });
  broadcast({ type: 'SYSTEM_LOG', payload: log });

  res.status(201).json({ message: 'Dispatch order executed.', resource: newResource });
});

module.exports = router;
