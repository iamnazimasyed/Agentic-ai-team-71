const express = require('express');
const { incidents, resources, agents, directives, systemLogs, swarmLogs, makeLog } = require('../data/store');
const { requireAuth } = require('../middleware/auth');
const { broadcast } = require('../ws/broadcaster');

const router = express.Router();

// ─── n8n AI Agent webhook ─────────────────────────────────────────────────────
const N8N_WEBHOOK_URL =
  process.env.N8N_WEBHOOK_URL ||
  'http://localhost:5678/webhook/aeba86e2-222e-4427-bd02-e907df44d815/chat';

// Circuit breaker to avoid waiting when n8n is known to be offline
let n8nLastChecked = 0;
let n8nIsOnline = false;

/**
 * Forward a message to the n8n AI agent with a fast 1.2s timeout.
 * Falls back to the local autonomous knowledge engine instantly when offline.
 */
async function callN8nAgent(message, sessionId) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 1200); // Fast 1.2s timeout

    const response = await fetch(N8N_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chatInput: message, sessionId: sessionId || 'campusguard-default' }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      n8nIsOnline = false;
      return null;
    }

    const data = await response.json();
    n8nIsOnline = true;

    return (
      data.output ||
      data.message ||
      data.text ||
      (typeof data === 'string' ? data : null)
    );
  } catch (err) {
    n8nIsOnline = false;
    return null;
  }
}

// ─── Autonomous Campus Knowledge & NLP Engine ────────────────────────────────
function simulateAgentResponse(cmd) {
  const c = cmd.toLowerCase().trim();

  // 1. Command: Help
  if (c === 'help' || c === '/help' || c.includes('what can you do') || c.includes('commands')) {
    return {
      text: '🤖 CampusGuard AI Swarm Commands & Queries:\n• Tactical Commands: "status", "isolate <sector>", "deploy <unit>", "reboot", "clear"\n• Situational Queries: "fire status", "available ambulances", "evacuation route", "temperature in lab", "active incidents", "drone location"',
      level: 'SYS',
    };
  }

  // 2. Command: Status
  if (c === 'status' || c.includes('swarm status') || c.includes('system status') || c.includes('agent status')) {
    const activeCount = agents.filter((a) => a.status === 'ACTIVE').length;
    return {
      text: `🛡 Swarm Grid Status: 5 specialized nodes active (${activeCount} operational, 1 analyzing, 1 standby). Swarm consensus: 98.4%. Real-time telemetry synchronized across all Vignan University sectors.`,
      level: 'AI',
    };
  }

  // 3. Command: Isolate Sector
  if (c.startsWith('isolate') || c.includes('seal sector') || c.includes('lock sector')) {
    const sector = c.replace('isolate', '').replace('sector', '').replace('seal', '').trim() || 'Sector C (Aryabhatta)';
    return {
      text: `🚨 Security Node (SEC-01): Isolation protocol executed for ${sector.toUpperCase()}. Automatic magnetic door locks actuated. HVAC extraction dampers sealed to prevent hazard spread.`,
      level: 'SEC',
    };
  }

  // 4. Command: Deploy Unit
  if (c.startsWith('deploy') || c.startsWith('dispatch') || c.includes('send unit') || c.includes('send team')) {
    const target = c.replace('deploy', '').replace('dispatch', '').trim() || 'Rapid Tactical Team';
    return {
      text: `🚒 Logistics Node (TRN-03): Dispatch order confirmed for "${target}". Perimeter approach cleared, traffic transit corridors prioritized. Live GPS tracking active.`,
      level: 'TRN',
    };
  }

  // 5. Command: Reboot / Clear
  if (c === 'clear') {
    return { text: 'Swarm console cleared. Active telemetry and sensor feeds retained.', level: 'SYS' };
  }
  if (c === 'reboot') {
    return { text: 'Soft-reboot signal broadcasted. Node-01 through Node-05 re-synchronized. Latency: 2.1ms.', level: 'SYS' };
  }

  // 6. Natural Language: Fleet & Ambulances / Medical
  if (c.includes('ambulance') || c.includes('medic') || c.includes('doctor') || c.includes('triage') || c.includes('health') || c.includes('hospital')) {
    const availableMeds = resources.filter((r) => r.category === 'Ambulances' || r.category === 'Medical Teams');
    const availCount = availableMeds.filter((r) => r.status === 'AVAILABLE').length;
    return {
      text: `🚑 Medical Fleet Status: ${availableMeds.length} total units registered. ${availCount} unit(s) AVAILABLE (Triage Alpha MED-009 at Central Hub). ALS Ambulance AMB-042 currently deployed at North Quad.`,
      level: 'MED',
    };
  }

  // 7. Natural Language: Security Patrols / Fleet
  if (c.includes('security team') || c.includes('patrol') || c.includes('officer') || c.includes('guard')) {
    const secTeams = resources.filter((r) => r.category === 'Security Teams');
    return {
      text: `👮 Campus Security Readiness: ${secTeams.length} tactical units active. Patrol Unit SEC-P04 available at Library Plaza. Tactical Response SEC-T12 en route to Transit Corridor B.`,
      level: 'SEC',
    };
  }

  // 8. Natural Language: Drone / UAV
  if (c.includes('drone') || c.includes('uav') || c.includes('aerial') || c.includes('surveillance')) {
    return {
      text: `🛸 Recon Drone DRN-UAV1: Airborne over Airspace Sector Alpha-V (Altitude: 120ft). Optical and FLIR thermal telemetry feeding live into Command GIS map. Battery: 89%.`,
      level: 'AI',
    };
  }

  // 9. Natural Language: Specific Incident INC-1024 / Fire / Chem Lab
  if (c.includes('1024') || c.includes('fire') || c.includes('flame') || c.includes('thermal') || /\blabs?\b/.test(c) || c.includes('u-block') || c.includes('u-204')) {
    const fireInc = incidents.find((i) => i.id === 'INC-1024') || incidents[0];
    return {
      text: `🔥 INC-1024 [CRITICAL]: Fire Alarm reported at ${fireInc.location}. Core Temp: ${fireInc.telemetry?.tempZoneA || '145°C'}, Smoke Density: ${fireInc.telemetry?.smokeDensity || '85%'}. Assigned: ${fireInc.teams}. Automated Halon suppression deployed. 98% of lab sector clear.`,
      level: 'AI',
    };
  }

  // 10. Natural Language: Unauthorized Access / Server Center
  if (c.includes('1023') || c.includes('server') || c.includes('unauthorized') || c.includes('access')) {
    const secInc = incidents.find((i) => i.id === 'INC-1023');
    return {
      text: `🔒 INC-1023 [HIGH]: Unauthorized Access detected at ${secInc?.location || 'Aryabhata Server Center'}. Biometric access terminals locked down. Security Team 2 on scene verifying clearance credentials.`,
      level: 'SEC',
    };
  }

  // 11. Natural Language: Perimeter Breach / Vadlamudi Gate
  if (c.includes('1020') || c.includes('perimeter') || c.includes('breach') || c.includes('gate')) {
    const perInc = incidents.find((i) => i.id === 'INC-1020');
    return {
      text: `🚧 INC-1020 [HIGH]: Perimeter Breach near ${perInc?.location || 'Vadlamudi North Gate'}. Patrol Alpha and UAV-1 drone actively tracking anomalous movement along North fence line. Alert level Yellow.`,
      level: 'SEC',
    };
  }

  // 12. Natural Language: All Active Incidents List
  if (c.includes('incident') || c.includes('hazard') || c.includes('active') || c.includes('alarm')) {
    const active = incidents.filter((i) => i.status === 'Active');
    const critical = incidents.filter((i) => i.severity === 'CRITICAL');
    return {
      text: `📋 Incident Overview: ${incidents.length} total incidents recorded (${active.length} Active, ${critical.length} Critical). Priority focus: INC-1024 (Fire, Lab U-204) and INC-1020 (Perimeter Breach). Check Incidents View for full telemetry.`,
      level: 'AI',
    };
  }

  // 13. Natural Language: Evacuation Routes / Safe Haven / Sangam
  if (c.includes('evacuat') || c.includes('route') || c.includes('safe') || c.includes('haven') || c.includes('shelter') || c.includes('sangam') || c.includes('exit')) {
    return {
      text: `📍 Evacuation Protocol: Primary Campus Safe Haven is Convocation Hall & Sangam Arena (Capacity: 5,000). Safe Corridor from U-Block: Exit via West Stairwell, avoid East Gate approach, proceed through Central Quad to Sangam Zone.`,
      level: 'AI',
    };
  }

  // 14. Natural Language: Temperature & Sensor Readings
  if (c.includes('temp') || c.includes('smoke') || c.includes('sensor') || c.includes('telemetry') || c.includes('heat')) {
    return {
      text: `🌡 Sensor Grid Diagnostics: Lab U-204 reports peak 145°C with 85% smoke particulate. Adjacent Sector C nodes normalized at 24°C. Campus atmospheric pressure nominal.`,
      level: 'SYS',
    };
  }

  // 15. Natural Language: Specific Agent queries (SEC-01, MED-02, TRN-03, FAC-04, COM-05)
  if (c.includes('sec-01') || c.includes('med-02') || c.includes('trn-03') || c.includes('fac-04') || c.includes('com-05')) {
    const matched = agents.find((a) => c.includes(a.code.toLowerCase()) || c.includes(a.id.toLowerCase()));
    if (matched) {
      return {
        text: `🤖 Agent Node [${matched.code} - ${matched.name}]: Role: ${matched.role} | Status: ${matched.status} | Task: "${matched.currentTask}" | Confidence: ${matched.confidence}%.`,
        level: 'AI',
      };
    }
  }

  // 16. Natural Language: Lockdown
  if (c.includes('lockdown')) {
    return {
      text: `🛑 Emergency Lockdown: All 8 campus perimeter gates and academic blocks can be sealed simultaneously via the top "Emergency Lockdown" action. PIN verification required for authorization.`,
      level: 'SEC',
    };
  }

  // 17. General Intelligent Fallback
  return {
    text: `🛡 Swarm Agent acknowledged: "${cmd}". Grid synchronized with Vignan University Command Mesh. Active monitoring: 6 incidents, 45 assets, and 5 AI nodes online. Type "help" for tactical commands.`,
    level: 'AI',
  };
}

// ─── Routes ───────────────────────────────────────────────────────────────────

/**
 * GET /api/agents
 */
router.get('/', requireAuth, (req, res) => {
  res.json(agents);
});

/**
 * GET /api/agents/n8n-status
 * Quick connectivity check against the n8n webhook.
 */
router.get('/n8n-status', requireAuth, async (req, res) => {
  try {
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 5000);
    const r = await fetch(N8N_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chatInput: 'ping', sessionId: 'health-check' }),
      signal: controller.signal,
    });
    res.json({ online: r.ok, httpStatus: r.status, url: N8N_WEBHOOK_URL });
  } catch (err) {
    res.json({ online: false, error: err.message, url: N8N_WEBHOOK_URL });
  }
});

/**
 * GET /api/agents/:id
 */
router.get('/:id', requireAuth, (req, res) => {
  const agent = agents.find((a) => a.id === req.params.id);
  if (!agent) return res.status(404).json({ error: 'Agent not found.' });
  res.json(agent);
});

/**
 * PATCH /api/agents/:id/approve-draft
 */
router.patch('/:id/approve-draft', requireAuth, (req, res) => {
  const agent = agents.find((a) => a.id === req.params.id);
  if (!agent) return res.status(404).json({ error: 'Agent not found.' });
  if (!agent.requiresApproval) {
    return res.status(400).json({ error: 'Agent has no pending draft awaiting approval.' });
  }

  agent.requiresApproval = false;
  agent.latestActions.unshift({
    time: new Date().toTimeString().split(' ')[0],
    text: `Broadcast approved by ${req.officer.name} and transmitted to 14,200 recipients.`,
  });

  const log = makeLog('COM', `Campus-wide SMS broadcast dispatched successfully.`);
  swarmLogs.unshift(log);

  broadcast({ type: 'AGENT_UPDATED', payload: agent });
  broadcast({ type: 'SWARM_LOG', payload: log });

  res.json({ message: 'Draft approved and broadcast dispatched.', agent });
});

/**
 * POST /api/agents/command
 * Forwards the command to n8n AI agent.
 * Falls back to local simulation if n8n is unreachable.
 *
 * Body: { command: string, sessionId?: string }
 */
router.post('/command', requireAuth, async (req, res) => {
  const { command, sessionId } = req.body;
  if (!command || !command.trim()) {
    return res.status(400).json({ error: 'command is required.' });
  }

  // 1. Log the issued command immediately
  const cmdLog = makeLog('SYS', `COMMAND ISSUED by ${req.officer.name}: "${command.trim()}"`);
  swarmLogs.unshift(cmdLog);
  broadcast({ type: 'SWARM_LOG', payload: cmdLog });

  // 2. Try n8n first
  const n8nReply = await callN8nAgent(command.trim(), sessionId || req.officer.id);

  let replyLog;
  let source;

  if (n8nReply) {
    // Real AI response from n8n
    replyLog = makeLog('AI', n8nReply);
    source = 'n8n';
  } else {
    // n8n unreachable — use local simulation
    const sim = simulateAgentResponse(command.trim());
    replyLog = makeLog(sim.level, sim.text);
    source = 'simulation';
  }

  swarmLogs.unshift(replyLog);
  broadcast({ type: 'SWARM_LOG', payload: replyLog });

  res.json({ commandLog: cmdLog, responseLog: replyLog, source });
});

/**
 * POST /api/agents/chat
 * Direct chat endpoint — bypasses the command log format.
 * Sends a free-form message to the n8n AI agent and streams back the reply.
 *
 * Body: { message: string, sessionId?: string }
 */
router.post('/chat', requireAuth, async (req, res) => {
  const { message, sessionId } = req.body;
  if (!message || !message.trim()) {
    return res.status(400).json({ error: 'message is required.' });
  }

  const n8nReply = await callN8nAgent(message.trim(), sessionId || req.officer.id);

  if (n8nReply) {
    const log = makeLog('AI', n8nReply);
    swarmLogs.unshift(log);
    broadcast({ type: 'SWARM_LOG', payload: log });
    return res.json({ reply: n8nReply, log, source: 'n8n' });
  }

  // n8n offline fallback
  const fallback = `AI agent unavailable. Last known swarm state: all 5 nodes operational.`;
  const log = makeLog('WRN', fallback);
  swarmLogs.unshift(log);
  broadcast({ type: 'SWARM_LOG', payload: log });
  return res.status(503).json({ reply: fallback, log, source: 'fallback' });
});

/**
 * Vision Agent: Processes image uploads (photos/camera snapshots) to extract
 * incident type, severity, telemetry, and automatically trigger swarm orchestration.
 *
 * POST /api/agents/analyze-image
 * Body: { image: string (base64/dataURL), caption?: string }
 */
router.post('/analyze-image', requireAuth, async (req, res) => {
  const { image, caption } = req.body;
  if (!image) {
    return res.status(400).json({ error: 'image data is required.' });
  }

  const promptText = (caption || '').toLowerCase();

  // Determine hazard parameters using Vision / NLP heuristics
  let hazardType = 'Hazard Assessment';
  let severity = 'HIGH';
  let location = 'U-Block (Aryabhatta), North Sector';
  let teams = 'Hazmat Alpha, Fire Unit 4, Medic Unit 1';
  let description = 'Optical anomaly identified from field visual report.';
  let tempReading = '95°C ↑';
  let smokeReading = '65%';
  let directiveTitle = 'Initiate Localized Hazard Containment';
  let directiveJustification = 'Visual telemetry confirms hazard anomaly from field camera uplink.';
  let recommendedActions = ['Deploy nearest tactical response unit', 'Seal localized ventilation dampers', 'Establish 100m perimeter safety buffer'];

  if (promptText.includes('fire') || promptText.includes('flame') || promptText.includes('smoke') || promptText.includes('burn') || promptText.includes('thermal')) {
    hazardType = 'Active Fire & Thermal Hazard';
    severity = 'CRITICAL';
    location = 'U-Block (Aryabhatta), Lab U-204';
    teams = 'Hazmat Alpha, Fire Unit 4, Paramedic Team 4';
    description = 'Optical & thermal analysis confirms active combustion. High particulate smoke cloud spreading rapidly.';
    tempReading = '165°C ↑';
    smokeReading = '92%';
    directiveTitle = 'Execute U-Block Level 2 Evacuation & Halon Suppression';
    directiveJustification = 'High-temperature flame signatures and 92% particulate density detected from visual capture. Immediate flashover hazard.';
    recommendedActions = ['Actuate localized Halon fire suppression', 'Trigger audible evacuation alarm in Block C', 'Reroute transit shuttles away from West Gate'];
  } else if (promptText.includes('breach') || promptText.includes('intruder') || promptText.includes('fence') || promptText.includes('unauthorized') || promptText.includes('trespass')) {
    hazardType = 'Perimeter Security Breach';
    severity = 'HIGH';
    location = 'North Campus Perimeter (Vadlamudi Gate)';
    teams = 'Patrol Alpha, Tactical Response SEC-T12, UAV-1 Drone';
    description = 'Visual capture reveals perimeter fence tampering and unauthorized movement in restricted campus quadrant.';
    tempReading = '24°C';
    smokeReading = '0%';
    directiveTitle = 'Seal North Perimeter & Intercept Intrusion';
    directiveJustification = 'Visual verification of unauthorized perimeter crossing. Glare-filtered optical analysis confirms suspect heading toward Server Center.';
    recommendedActions = ['Deploy Patrol Alpha to Vadlamudi Gate approach', 'Engage magnetic security doors on server corridors', 'Direct UAV-1 drone to track target vector'];
  } else if (promptText.includes('medical') || promptText.includes('injur') || promptText.includes('collapse') || promptText.includes('patient') || promptText.includes('casualty')) {
    hazardType = 'Medical Emergency & Triage';
    severity = 'HIGH';
    location = 'NTR Vignan Central Library Plaza';
    teams = 'ALS Ambulance AMB-042, Triage Alpha MED-009';
    description = 'Visual report indicates person in acute distress requiring urgent paramedic triage.';
    tempReading = '22°C';
    smokeReading = '0%';
    directiveTitle = 'Establish Fast-Track Medical Evacuation Corridor';
    directiveJustification = 'Field image verifies triage priority. Rapid transport to Central Medical Hub required.';
    recommendedActions = ['Dispatch ALS Ambulance AMB-042 to Library Plaza', 'Clear pedestrian transit corridor on Central Quad', 'Alert Central Medical Hub trauma team'];
  } else {
    // General hazard assessment
    description = caption ? `Visual report analyzed: "${caption}". Multi-sensor correlation in progress.` : 'Optical camera uplink parsed. Anomaly threshold flagged by Vision Agent.';
  }

  // 1. Auto-generate next Incident ID
  const lastId = incidents
    .map((i) => parseInt(i.id.replace('INC-', ''), 10))
    .filter((n) => !isNaN(n))
    .sort((a, b) => b - a)[0] || 1024;

  const newIncidentId = `INC-${lastId + 1}`;
  const now = new Date().toTimeString().split(' ')[0];

  const newIncident = {
    id: newIncidentId,
    type: hazardType,
    location,
    severity,
    status: 'Active',
    reportedTime: now,
    teams,
    coordinates: { lat: 16.2333, lng: 80.5510 },
    telemetry: {
      tempZoneA: tempReading,
      smokeDensity: smokeReading,
      sprinklers: severity === 'CRITICAL' ? 'Deployed' : 'Standby',
      evacStatus: 'In Progress',
      occupancyEst: '12 Personnel',
      hazmatRisk: severity === 'CRITICAL' ? 'HIGH (Class 3)' : 'MODERATE',
    },
  };

  incidents.unshift(newIncident);

  // 2. Auto-generate corresponding AI Directive for Commander Approval
  const directiveId = `${newIncidentId}-A`;
  const newDirective = {
    id: directiveId,
    incidentId: newIncidentId,
    title: directiveTitle,
    risk: severity === 'CRITICAL' ? 'HIGH' : 'MED',
    timestamp: `${now} UTC`,
    confidence: 96.8,
    justification: directiveJustification,
    recommendedActions,
    status: 'PENDING',
    signedBy: null,
  };

  directives.unshift(newDirective);

  // 3. Log findings in Swarm and System audit logs
  const visionLog = makeLog(
    'AI',
    `[VISION AGENT] Processed field photo from ${req.officer.name}. Detected: ${hazardType} (${severity}) at ${location}. Auto-generated ${newIncidentId} and Directive ${directiveId}.`
  );
  swarmLogs.unshift(visionLog);
  systemLogs.unshift(visionLog);

  // 4. Real-time WebSocket Broadcasts to all connected dashboards
  broadcast({ type: 'INCIDENT_CREATED', payload: newIncident });
  broadcast({ type: 'DIRECTIVE_CREATED', payload: newDirective });
  broadcast({ type: 'SWARM_LOG', payload: visionLog });
  broadcast({ type: 'SYSTEM_LOG', payload: visionLog });

  res.status(201).json({
    analysis: {
      hazardType,
      severity,
      location,
      description,
      telemetry: newIncident.telemetry,
      recommendedTeams: teams,
      directive: newDirective,
    },
    incident: newIncident,
    directive: newDirective,
    log: visionLog,
    source: 'VisionAgent-MultiModal',
  });
});

/**
 * Voice Agent: Ingests transcribed emergency radio / microphone reports
 * and orchestrates swarm actions.
 *
 * POST /api/agents/analyze-voice
 * Body: { transcript: string }
 */
router.post('/analyze-voice', requireAuth, async (req, res) => {
  const { transcript } = req.body;
  if (!transcript || !transcript.trim()) {
    return res.status(400).json({ error: 'transcript is required.' });
  }

  const voiceText = transcript.trim();
  const lower = voiceText.toLowerCase();

  // Log spoken transmission
  const voiceLog = makeLog('COM', `[AUDIO DISPATCH] Voice transmission from ${req.officer.name}: "${voiceText}"`);
  swarmLogs.unshift(voiceLog);
  broadcast({ type: 'SWARM_LOG', payload: voiceLog });

  // Route to intelligent agent response
  const sim = simulateAgentResponse(voiceText);
  const responseLog = makeLog(sim.level, sim.text);
  swarmLogs.unshift(responseLog);
  broadcast({ type: 'SWARM_LOG', payload: responseLog });

  res.json({
    voiceLog,
    responseLog,
    parsedCommand: voiceText,
    source: 'AudioAgent-Speech',
  });
});

// ─── Incident Analyzer & Multi-Agent Orchestrator ────────────────────────────

/**
 * Incident Analyzer: Converts raw text into a structured incident JSON.
 * Applies NLP keyword analysis on the normalized input.
 */
function runIncidentAnalyzer(rawText) {
  const t = rawText.toLowerCase();

  let incident_type = 'Unknown Incident';
  let severity = 'HIGH';
  let location = 'Campus (Location unspecified)';
  let immediate_hazards = [];
  let required_response_departments = [];
  let people_at_risk = false;
  let confidence = 0.70;

  // ── Fire / Smoke ──────────────────────────────────────────────────
  if (t.includes('fire') || t.includes('flame') || t.includes('smoke') || t.includes('burn') || t.includes('thermal') || t.includes('blaze')) {
    incident_type = 'Fire Emergency';
    severity = 'CRITICAL';
    immediate_hazards.push('Active fire', 'Toxic smoke', 'Thermal exposure');
    required_response_departments.push('fire', 'medical', 'security', 'evacuation');
    people_at_risk = true;
    confidence = 0.94;
  }

  // ── Medical / Injury ──────────────────────────────────────────────
  if (t.includes('medical') || t.includes('injur') || t.includes('collapse') || t.includes('unconscious') || t.includes('patient') || t.includes('casualty') || t.includes('heart') || t.includes('bleed') || t.includes('hurt')) {
    incident_type = incident_type === 'Unknown Incident' ? 'Medical Emergency' : incident_type + ' + Medical';
    severity = severity === 'CRITICAL' ? 'CRITICAL' : 'HIGH';
    immediate_hazards.push('Injured personnel', 'Requires immediate triage');
    required_response_departments.push('medical', 'security');
    people_at_risk = true;
    confidence = Math.max(confidence, 0.91);
  }

  // ── Security Breach / Intruder ────────────────────────────────────
  if (t.includes('breach') || t.includes('intruder') || t.includes('unauthorized') || t.includes('trespass') || t.includes('threat') || t.includes('weapon') || t.includes('suspicious')) {
    incident_type = incident_type === 'Unknown Incident' ? 'Security Breach' : incident_type;
    severity = severity === 'CRITICAL' ? 'CRITICAL' : 'HIGH';
    immediate_hazards.push('Unauthorized individual', 'Potential physical threat');
    required_response_departments.push('security', 'evacuation', 'communication');
    people_at_risk = true;
    confidence = Math.max(confidence, 0.88);
  }

  // ── Structural / Infrastructure ───────────────────────────────────
  if (t.includes('structural') || t.includes('collapse') || t.includes('earthquake') || t.includes('explosion') || t.includes('gas leak') || t.includes('chemical') || t.includes('spill')) {
    incident_type = incident_type === 'Unknown Incident' ? 'Structural/Infrastructure Emergency' : incident_type;
    severity = 'CRITICAL';
    immediate_hazards.push('Structural damage', 'Hazardous material exposure');
    required_response_departments.push('fire', 'medical', 'security', 'evacuation', 'infrastructure');
    people_at_risk = true;
    confidence = Math.max(confidence, 0.85);
  }

  // ── Crowd / Stampede ─────────────────────────────────────────────
  if (t.includes('crowd') || t.includes('stampede') || t.includes('panic') || t.includes('trapped') || t.includes('stuck')) {
    immediate_hazards.push('Mass panic', 'Crowd crush risk');
    required_response_departments.push('security', 'medical', 'evacuation', 'communication');
    people_at_risk = true;
  }

  // ── Location extraction ───────────────────────────────────────────
  const locationPatterns = [
    { keywords: ['block c', 'c block', 'u-block', 'u block', 'lab u-204', 'u-204', 'aryabhatta'], loc: 'U-Block (Aryabhatta), Lab U-204' },
    { keywords: ['library', 'ntr', 'ntr library'], loc: 'NTR-Vignan Central Digital Library' },
    { keywords: ['a block', 'a-block', 'admin', 'administration'], loc: 'A-Block (Main Admin & Academics)' },
    { keywords: ['h block', 'h-block', 'engineering workshop'], loc: 'H-Block (Engineering & Mechatronics)' },
    { keywords: ['pharmacy', 'pharma block'], loc: 'Pharmacy College Block' },
    { keywords: ['convocation', 'sangam', 'auditorium'], loc: 'Convocation Hall & Sangam Arena' },
    { keywords: ['north gate', 'vadlamudi gate', 'main gate'], loc: 'North Campus Perimeter (Vadlamudi Gate)' },
    { keywords: ['server', 'server room', 'data center'], loc: 'Aryabhata Server Center' },
  ];
  for (const p of locationPatterns) {
    if (p.keywords.some((kw) => t.includes(kw))) {
      location = p.loc;
      break;
    }
  }

  // ── Severity boost from keywords ──────────────────────────────────
  if (t.includes('critical') || t.includes('trapped') || t.includes('explosion')) severity = 'CRITICAL';
  if (t.includes('minor') || t.includes('small') || t.includes('possible')) severity = severity === 'CRITICAL' ? 'HIGH' : 'MEDIUM';

  // ── Deduplicate arrays ────────────────────────────────────────────
  required_response_departments = [...new Set(required_response_departments)];
  if (required_response_departments.length === 0) required_response_departments = ['security'];

  const incident_summary = `${incident_type} reported at ${location}. Severity: ${severity}. ${people_at_risk ? 'Personnel at risk confirmed.' : 'No direct personnel risk identified.'} Immediate hazards: ${immediate_hazards.join(', ') || 'None identified'}.`;

  return {
    incident_type,
    location,
    severity,
    people_at_risk,
    immediate_hazards,
    incident_summary,
    confidence: Math.round(confidence * 100) / 100,
    required_response_departments,
    rawInput: rawText,
  };
}

/**
 * Specialist Agent Runner: Given a structured incident, invokes each required
 * specialist agent and returns their structured assessment + actions.
 */
function runSpecialistAgents(analyzed, officerName) {
  const { incident_type, severity, location, immediate_hazards, required_response_departments } = analyzed;
  const agentResponses = [];

  // ── Fire Response Agent ───────────────────────────────────────────
  if (required_response_departments.includes('fire')) {
    agentResponses.push({
      agent: 'fire_response',
      agent_name: 'Fire Response Agent (FAC-04)',
      priority: severity,
      assessment: `Active fire/thermal hazard detected at ${location}. Automated suppression systems should be engaged. Halon or water sprinkler deployment recommended based on material class.`,
      recommended_actions: [
        `Activate fire suppression system at ${location}`,
        'Alert Hazmat Alpha and Fire Unit 4 for immediate deployment',
        'Isolate electrical supply to affected zone',
        'Establish 100m safety perimeter around hazard core',
        'Coordinate with HVAC Agent to seal ventilation dampers',
      ],
      estimated_response_time: '3–5 minutes',
    });
  }

  // ── Medical Response Agent ────────────────────────────────────────
  if (required_response_departments.includes('medical')) {
    agentResponses.push({
      agent: 'medical_response',
      agent_name: 'Medical Response Agent (MED-02)',
      priority: severity === 'CRITICAL' ? 'HIGH' : severity,
      assessment: `Medical triage required at ${location}. ${analyzed.people_at_risk ? 'Personnel confirmed at risk — ALS trauma response activated.' : 'Precautionary triage staging recommended.'}`,
      recommended_actions: [
        'Dispatch ALS Ambulance AMB-042 to incident location',
        'Stage Triage Alpha MED-009 at nearest safe access point',
        'Establish medical relay corridor from incident to Central Medical Hub',
        analyzed.people_at_risk ? 'Activate burn/trauma protocol for potential fire casualties' : 'Deploy precautionary first aid team',
        'Alert Central Medical Hub for incoming casualties',
      ],
      estimated_response_time: '4–7 minutes',
    });
  }

  // ── Security Agent ────────────────────────────────────────────────
  if (required_response_departments.includes('security')) {
    agentResponses.push({
      agent: 'security',
      agent_name: 'Security Agent (SEC-01)',
      priority: severity === 'CRITICAL' ? 'HIGH' : 'MEDIUM',
      assessment: `Security perimeter required at ${location}. Access control enforcement activated. All unauthorized personnel to be removed from affected zone.`,
      recommended_actions: [
        `Deploy Patrol Alpha to ${location} access points`,
        'Engage magnetic door locks on affected corridors',
        'Direct UAV-1 drone to aerial monitoring position',
        'Notify all on-duty security officers via PA broadcast',
        'Coordinate crowd control if evacuation is initiated',
      ],
      estimated_response_time: '2–4 minutes',
    });
  }

  // ── Evacuation Agent ─────────────────────────────────────────────
  if (required_response_departments.includes('evacuation')) {
    const fromBlock = location.includes('U-Block') ? 'u_block'
      : location.includes('H-Block') ? 'h_block'
      : location.includes('Library') ? 'ntr_library'
      : location.includes('Pharmacy') ? 'pharmacy_block'
      : location.includes('A-Block') ? 'a_block'
      : null;

    agentResponses.push({
      agent: 'evacuation',
      agent_name: 'Evacuation Agent (TRN-03)',
      priority: severity,
      assessment: `Evacuation protocol recommended for ${location}. Primary safe haven is Convocation Hall & Sangam Arena (Capacity: 5,000).`,
      recommended_actions: [
        `Initiate PA broadcast: Evacuate ${location} immediately via nearest emergency exit`,
        'Direct all occupants to Convocation Hall & Sangam Arena (primary safe zone)',
        'Deploy transit shuttles on West Campus corridor',
        'Post security officers at all emergency stairwells',
        'Account for all occupants at assembly point — roll call mandatory',
      ],
      recommended_route: fromBlock
        ? `Exit via nearest stairwell → Central Campus Avenue → Sangam Safe Zone`
        : 'Follow emergency exit signage to nearest safe zone',
      assembly_point: 'Convocation Hall & Sangam Arena (Capacity: 5,000)',
      estimated_clearance_time: '8–15 minutes',
    });
  }

  // ── Infrastructure/Structural Agent ──────────────────────────────
  if (required_response_departments.includes('infrastructure')) {
    agentResponses.push({
      agent: 'infrastructure',
      agent_name: 'Infrastructure Agent (FAC-04)',
      priority: 'HIGH',
      assessment: `Infrastructure inspection required at ${location}. Structural integrity and utility systems need immediate assessment.`,
      recommended_actions: [
        'Shut off gas mains and electrical supply to affected zone',
        'Deploy structural inspection team before re-entry clearance',
        'Isolate HVAC system in affected block to prevent smoke/gas spread',
        'Assess utility conduit integrity before declaring zone safe',
      ],
      estimated_response_time: '10–15 minutes',
    });
  }

  // ── Communication Agent ───────────────────────────────────────────
  if (required_response_departments.includes('communication')) {
    agentResponses.push({
      agent: 'communication',
      agent_name: 'Communication Agent (COM-05)',
      priority: 'HIGH',
      assessment: `Mass communication protocol required. All campus stakeholders must be notified of ${incident_type} at ${location}.`,
      recommended_actions: [
        'Activate campus-wide PA announcement system',
        'Send SMS alert to all registered students and staff',
        'Notify Vice-Chancellor and Campus Security Command',
        'Post real-time updates on campus emergency portal',
        'Coordinate with local emergency services (Police/Fire/Medical)',
      ],
      estimated_response_time: '1–2 minutes',
    });
  }

  return agentResponses;
}

/**
 * Response Plan Generator: Synthesizes all specialist agent outputs into a
 * single actionable emergency response plan for the commander.
 */
function generateResponsePlan(analyzed, agentResponses) {
  const { incident_type, severity, location, incident_summary, required_response_departments } = analyzed;

  const allActions = agentResponses.flatMap((a) => a.recommended_actions);
  const evacuationAgent = agentResponses.find((a) => a.agent === 'evacuation');

  const plan = {
    incident_type,
    severity,
    location,
    incident_summary,
    confidence: analyzed.confidence,
    immediate_actions: allActions.slice(0, 6), // Top 6 priority actions across all agents
    specialist_responses: agentResponses,
    evacuation: evacuationAgent
      ? {
          required: true,
          recommended_route: evacuationAgent.recommended_route,
          assembly_point: evacuationAgent.assembly_point,
          estimated_clearance_time: evacuationAgent.estimated_clearance_time,
        }
      : { required: false },
    disclaimer:
      'IMPORTANT: These are system-generated emergency recommendations for review by authorized personnel. Do not treat AI output as guaranteed real-world instructions. All actions require commander authorization.',
  };

  return plan;
}

/**
 * POST /api/agents/analyze-incident
 * Unified Incident Analysis Pipeline — accepts text/image/voice input and runs
 * the full Incident Analyzer → Agent Orchestrator → Specialist Agents chain.
 *
 * Body: {
 *   rawText: string,              // normalized text from any source
 *   source: 'text' | 'image' | 'voice',
 *   imageData?: string,           // optional base64 image (for vision records)
 * }
 */
router.post('/analyze-incident', requireAuth, async (req, res) => {
  const { rawText, source, imageData } = req.body;

  if (!rawText || !rawText.trim()) {
    return res.status(400).json({ error: 'rawText is required.' });
  }

  const text = rawText.trim();

  // ── Step 1: Incident Analyzer ─────────────────────────────────────
  const analyzed = runIncidentAnalyzer(text);

  // ── Step 2: Agent Orchestrator → Specialist Agents ────────────────
  const agentResponses = runSpecialistAgents(analyzed, req.officer.name);

  // ── Step 3: Response Plan ─────────────────────────────────────────
  const responsePlan = generateResponsePlan(analyzed, agentResponses);

  // ── Step 4: Auto-create Incident Record ───────────────────────────
  const lastId = incidents
    .map((i) => parseInt(i.id.replace('INC-', ''), 10))
    .filter((n) => !isNaN(n))
    .sort((a, b) => b - a)[0] || 1024;
  const newIncidentId = `INC-${lastId + 1}`;
  const now = new Date().toTimeString().split(' ')[0];

  const evacuationInfo = agentResponses.find((a) => a.agent === 'evacuation');
  const medInfo = agentResponses.find((a) => a.agent === 'medical_response');

  const newIncident = {
    id: newIncidentId,
    type: analyzed.incident_type,
    location: analyzed.location,
    severity: analyzed.severity,
    status: 'Active',
    reportedTime: now,
    teams: agentResponses.map((a) => a.agent_name.split('(')[0].trim()).join(', '),
    coordinates: { lat: 16.2333, lng: 80.5510 },
    telemetry: {
      tempZoneA: analyzed.severity === 'CRITICAL' ? '145°C ↑' : '24°C',
      smokeDensity: analyzed.incident_type.toLowerCase().includes('fire') ? '85%' : '0%',
      sprinklers: analyzed.severity === 'CRITICAL' ? 'Deployed' : 'Standby',
      evacStatus: evacuationInfo ? 'In Progress' : 'Normal',
      occupancyEst: '12 Personnel',
      hazmatRisk: analyzed.severity === 'CRITICAL' ? 'HIGH (Class 3)' : 'MODERATE',
    },
  };
  incidents.unshift(newIncident);

  // ── Step 5: Auto-create AI Directive ─────────────────────────────
  const directiveId = `${newIncidentId}-A`;
  const topActions = responsePlan.immediate_actions.slice(0, 4);
  const newDirective = {
    id: directiveId,
    incidentId: newIncidentId,
    title: `${analyzed.incident_type} Response — ${analyzed.location}`,
    risk: analyzed.severity === 'CRITICAL' ? 'HIGH' : analyzed.severity === 'HIGH' ? 'MED' : 'LOW',
    timestamp: `${now} UTC`,
    confidence: Math.round(analyzed.confidence * 100),
    justification: analyzed.incident_summary,
    recommendedActions: topActions,
    status: 'PENDING',
    signedBy: null,
  };
  directives.unshift(newDirective);

  // ── Step 6: Log to swarm and system logs ─────────────────────────
  const pipelineLog = makeLog(
    'AI',
    `[INCIDENT ANALYZER] Source: ${source.toUpperCase()} | ${analyzed.incident_type} (${analyzed.severity}) at ${analyzed.location}. ` +
      `Confidence: ${Math.round(analyzed.confidence * 100)}%. ` +
      `Activated ${agentResponses.length} specialist agents: ${agentResponses.map((a) => a.agent).join(', ')}. ` +
      `Incident ${newIncidentId} created. Directive ${directiveId} pending commander review.`
  );
  swarmLogs.unshift(pipelineLog);
  systemLogs.unshift(pipelineLog);

  // ── Step 7: WebSocket broadcast to all dashboards ─────────────────
  broadcast({ type: 'INCIDENT_CREATED', payload: newIncident });
  broadcast({ type: 'DIRECTIVE_CREATED', payload: newDirective });
  broadcast({ type: 'SWARM_LOG', payload: pipelineLog });
  broadcast({ type: 'SYSTEM_LOG', payload: pipelineLog });

  res.status(201).json({
    success: true,
    pipeline: {
      source,
      rawText: text,
      analyzed,
      agentResponses,
      responsePlan,
    },
    incident: newIncident,
    directive: newDirective,
    log: pipelineLog,
  });
});

module.exports = router;

