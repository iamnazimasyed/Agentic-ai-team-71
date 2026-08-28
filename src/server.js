require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const WebSocket = require('ws');

const { init: initBroadcaster, broadcast } = require('./ws/broadcaster');
const { systemLogs, makeLog } = require('./data/store');

const authRouter = require('./routes/auth');
const incidentsRouter = require('./routes/incidents');
const resourcesRouter = require('./routes/resources');
const agentsRouter = require('./routes/agents');
const directivesRouter = require('./routes/directives');
const logsRouter = require('./routes/logs');
const lockdownRouter = require('./routes/lockdown');
const notificationsRouter = require('./routes/notifications');

const app = express();
const PORT = process.env.PORT || 4000;

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(
  cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  })
);
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));

// ─── Root & Health ────────────────────────────────────────────────────────────
app.get('/', (_req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <title>CampusGuard AI — Backend API</title>
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #070A0E; color: #e1e2ec; font-family: 'Segoe UI', monospace; padding: 48px 32px; }
        h1 { color: #3B82F6; font-size: 1.6rem; margin-bottom: 8px; }
        p  { color: #8c909f; margin-bottom: 32px; font-size: 0.9rem; }
        .badge { display: inline-block; background: #10b981; color: #000; font-weight: 700;
                 font-size: 0.72rem; padding: 2px 10px; border-radius: 999px; margin-bottom: 32px; }
        table { border-collapse: collapse; width: 100%; max-width: 720px; font-size: 0.82rem; }
        th { text-align: left; color: #8c909f; text-transform: uppercase; letter-spacing: .08em;
             font-size: 0.72rem; padding: 8px 12px; border-bottom: 1px solid #1E293B; }
        td { padding: 10px 12px; border-bottom: 1px solid #111827; color: #c2c6d6; }
        td:first-child { color: #60a5fa; font-weight: 600; font-family: monospace; }
        td:nth-child(2) { color: #34d399; }
        tr:hover td { background: #111827; }
        .ws { color: #a78bfa; }
      </style>
    </head>
    <body>
      <h1>🛡 CampusGuard AI — Backend API</h1>
      <p>Vignan University Emergency Command System</p>
      <span class="badge">● ONLINE</span>

      <table>
        <thead>
          <tr><th>Method</th><th>Endpoint</th><th>Description</th></tr>
        </thead>
        <tbody>
          <tr><td>GET</td><td>/health</td><td>Health check</td></tr>
          <tr><td colspan="3" style="color:#8c909f;padding:12px;background:#0B0F17">── AUTH ──</td></tr>
          <tr><td>POST</td><td>/api/auth/login</td><td>Login with officerId + password → JWT</td></tr>
          <tr><td>GET</td><td>/api/auth/me</td><td>Current officer profile</td></tr>
          <tr><td colspan="3" style="color:#8c909f;padding:12px;background:#0B0F17">── INCIDENTS ──</td></tr>
          <tr><td>GET</td><td>/api/incidents</td><td>List incidents (filter: severity, status, search)</td></tr>
          <tr><td>GET</td><td>/api/incidents/:id</td><td>Get single incident</td></tr>
          <tr><td>POST</td><td>/api/incidents</td><td>Create incident</td></tr>
          <tr><td>PATCH</td><td>/api/incidents/:id</td><td>Update incident</td></tr>
          <tr><td>DELETE</td><td>/api/incidents/:id</td><td>Resolve incident</td></tr>
          <tr><td colspan="3" style="color:#8c909f;padding:12px;background:#0B0F17">── RESOURCES ──</td></tr>
          <tr><td>GET</td><td>/api/resources</td><td>List resources (filter: category, status, search)</td></tr>
          <tr><td>GET</td><td>/api/resources/stats</td><td>Fleet availability counts</td></tr>
          <tr><td>POST</td><td>/api/resources</td><td>Register new resource</td></tr>
          <tr><td>PATCH</td><td>/api/resources/:id</td><td>Update resource</td></tr>
          <tr><td>POST</td><td>/api/resources/dispatch</td><td>Rapid dispatch order</td></tr>
          <tr><td colspan="3" style="color:#8c909f;padding:12px;background:#0B0F17">── AI AGENTS ──</td></tr>
          <tr><td>GET</td><td>/api/agents</td><td>List all AI agent nodes</td></tr>
          <tr><td>PATCH</td><td>/api/agents/:id/approve-draft</td><td>Approve broadcast draft</td></tr>
          <tr><td>POST</td><td>/api/agents/command</td><td>Send CLI command to swarm</td></tr>
          <tr><td colspan="3" style="color:#8c909f;padding:12px;background:#0B0F17">── DIRECTIVES ──</td></tr>
          <tr><td>GET</td><td>/api/directives</td><td>List directives (filter: status)</td></tr>
          <tr><td>POST</td><td>/api/directives</td><td>Create directive</td></tr>
          <tr><td>PATCH</td><td>/api/directives/:id/approve</td><td>Approve directive</td></tr>
          <tr><td>PATCH</td><td>/api/directives/:id/reject</td><td>Reject directive</td></tr>
          <tr><td>PATCH</td><td>/api/directives/:id/modify</td><td>Amend directive</td></tr>
          <tr><td colspan="3" style="color:#8c909f;padding:12px;background:#0B0F17">── LOGS ──</td></tr>
          <tr><td>GET</td><td>/api/logs/system</td><td>System operation logs</td></tr>
          <tr><td>GET</td><td>/api/logs/swarm</td><td>AI swarm activity logs</td></tr>
          <tr><td>POST</td><td>/api/logs/system</td><td>Inject system log entry</td></tr>
          <tr><td>POST</td><td>/api/logs/swarm</td><td>Inject swarm log entry</td></tr>
          <tr><td colspan="3" style="color:#8c909f;padding:12px;background:#0B0F17">── LOCKDOWN ──</td></tr>
          <tr><td>GET</td><td>/api/lockdown/status</td><td>Current lockdown state</td></tr>
          <tr><td>POST</td><td>/api/lockdown/engage</td><td>Engage emergency lockdown</td></tr>
          <tr><td>POST</td><td>/api/lockdown/disengage</td><td>Lift lockdown</td></tr>
          <tr><td colspan="3" style="color:#8c909f;padding:12px;background:#0B0F17">── WEBSOCKET ──</td></tr>
          <tr><td class="ws">WS</td><td class="ws">ws://localhost:${PORT}/ws</td><td>Real-time event stream</td></tr>
          <tr><td colspan="3" style="color:#8c909f;padding:12px;background:#0B0F17">── n8n AI AGENT ──</td></tr>
          <tr><td>POST</td><td>/api/agents/command</td><td>Send swarm command → forwarded to n8n AI agent</td></tr>
          <tr><td>POST</td><td>/api/agents/chat</td><td>Direct free-form chat with n8n AI agent</td></tr>
          <tr><td>GET</td><td>/api/agents/n8n-status</td><td>Check n8n webhook connectivity</td></tr>
        </tbody>
      </table>

      <p style="margin-top:32px;font-size:0.75rem;">
        Frontend: <a href="http://localhost:3000" style="color:#3B82F6">http://localhost:3000</a>
        &nbsp;|&nbsp; Server time: ${new Date().toISOString()}
      </p>
    </body>
    </html>
  `);
});

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'CampusGuard AI Backend', timestamp: new Date().toISOString() });
});

// ─── API Routes ───────────────────────────────────────────────────────────────
app.use('/api/auth', authRouter);
app.use('/api/incidents', incidentsRouter);
app.use('/api/resources', resourcesRouter);
app.use('/api/agents', agentsRouter);
app.use('/api/directives', directivesRouter);
app.use('/api/logs', logsRouter);
app.use('/api/lockdown', lockdownRouter);
app.use('/api/notifications', notificationsRouter);

// ─── 404 Handler ─────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ error: 'Route not found.' });
});

// ─── Global Error Handler ────────────────────────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error('[ERROR]', err);
  res.status(500).json({ error: 'Internal server error.' });
});

// ─── HTTP + WebSocket Server ─────────────────────────────────────────────────
const server = http.createServer(app);

const wss = new WebSocket.Server({ server, path: '/ws' });
initBroadcaster(wss);

wss.on('connection', (ws, req) => {
  console.log(`[WS] Client connected from ${req.socket.remoteAddress}`);

  // Send a welcome snapshot so the client gets current state immediately
  ws.send(
    JSON.stringify({
      type: 'CONNECTED',
      payload: { message: 'CampusGuard AI WebSocket stream active.' },
    })
  );

  ws.on('message', (raw) => {
    try {
      const msg = JSON.parse(raw.toString());
      // Echo-back ping/pong keepalive
      if (msg.type === 'PING') {
        ws.send(JSON.stringify({ type: 'PONG', timestamp: Date.now() }));
      }
    } catch {
      // Ignore non-JSON messages
    }
  });

  ws.on('close', () => {
    console.log('[WS] Client disconnected.');
  });
});

// ─── Telemetry Heartbeat ─────────────────────────────────────────────────────
// Simulates live sensor ticks pushed to connected dashboards every 12 seconds,
// mirroring the frontend's setInterval clock ticker.
const TELEMETRY_MESSAGES = [
  { level: 'SYS', message: 'Node telemetry sync latency: 3.2ms.' },
  { level: 'AI',  message: 'Predictive risk gradient update: Sector 4G normalized.' },
  { level: 'SEC', message: 'Camera CAM-E2 heart-beat signal acknowledged.' },
  { level: 'MED', message: 'Triage Drone Alpha reports battery level 89%.' },
  { level: 'TRN', message: 'Perimeter shuttle route 2 checkpoint reached on schedule.' },
];

setInterval(() => {
  if (wss.clients.size === 0) return;
  if (Math.random() > 0.65) {
    const chosen = TELEMETRY_MESSAGES[Math.floor(Math.random() * TELEMETRY_MESSAGES.length)];
    const log = makeLog(chosen.level, chosen.message);
    systemLogs.unshift(log);
    // Keep system log buffer capped at 200 entries
    if (systemLogs.length > 200) systemLogs.pop();
    broadcast({ type: 'SYSTEM_LOG', payload: log });
  }
}, 12000);

// ─── Start ────────────────────────────────────────────────────────────────────
server.listen(PORT, () => {
  console.log(`\n✅  CampusGuard AI Backend running on http://localhost:${PORT}`);
  console.log(`🔌  WebSocket endpoint: ws://localhost:${PORT}/ws`);
  console.log(`📡  API base:           http://localhost:${PORT}/api\n`);
});
