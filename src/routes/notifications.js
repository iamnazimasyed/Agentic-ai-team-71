/**
 * CampusGuard AI — WhatsApp Notification Routes
 *
 * POST /api/notifications/whatsapp/send        — Send alert to specific contacts
 * POST /api/notifications/whatsapp/broadcast   — Broadcast to entire block or all
 * GET  /api/notifications/whatsapp/contacts    — List contacts (optionally filter by block)
 * GET  /api/notifications/whatsapp/status      — Check Twilio config status
 * POST /api/notifications/whatsapp/test        — Send test message to a single number
 */

const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { broadcast: wsBroadcast } = require('../ws/broadcaster');
const { systemLogs, swarmLogs, makeLog } = require('../data/store');
const { campusContacts, getContactsForBlock, resolveBlockFromLocation } = require('../data/contacts');
const { broadcastEmergencyAlert, sendWhatsAppMessage, composeMessage, getTwilioClient } = require('../services/whatsapp');

const router = express.Router();

// ─── Log helper ───────────────────────────────────────────────────────────────
function addLog(level, message) {
  const log = makeLog(level, message);
  systemLogs.unshift(log);
  swarmLogs.unshift(log);
  wsBroadcast({ type: 'SYSTEM_LOG', payload: log });
  wsBroadcast({ type: 'SWARM_LOG', payload: log });
  return log;
}

/**
 * GET /api/notifications/whatsapp/status
 * Returns whether Twilio is configured and ready.
 */
router.get('/whatsapp/status', requireAuth, (req, res) => {
  const client = getTwilioClient();
  const sid = process.env.TWILIO_ACCOUNT_SID || '';
  const from = process.env.TWILIO_WHATSAPP_FROM || 'whatsapp:+14155238886';
  const demoMode = !client;

  res.json({
    configured: !demoMode,
    demoMode,
    accountSid: sid ? `${sid.slice(0, 6)}...${sid.slice(-4)}` : null,
    fromNumber: from,
    totalContacts: campusContacts.length,
    message: demoMode
      ? 'Twilio not configured — running in Demo Mode. Messages will be logged but not sent. Add TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN to backend/.env to enable real delivery.'
      : 'Twilio configured. Ready to send WhatsApp messages.',
  });
});

/**
 * GET /api/notifications/whatsapp/contacts
 * Query: ?block=u_block  (optional)
 */
router.get('/whatsapp/contacts', requireAuth, (req, res) => {
  const { block } = req.query;
  const contacts = block ? getContactsForBlock(block) : campusContacts;

  // Mask phone numbers for security — show only last 4 digits
  const masked = contacts.map((c) => ({
    ...c,
    phone: `+${'*'.repeat(c.phone.length - 5)}${c.phone.slice(-4)}`,
  }));

  res.json({ contacts: masked, total: masked.length });
});

/**
 * POST /api/notifications/whatsapp/broadcast
 * Broadcasts emergency WhatsApp alert to contacts in the affected block.
 *
 * Body: {
 *   incidentId: string,
 *   incidentType: string,
 *   severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW',
 *   location: string,
 *   immediateActions: string[],
 *   evacuationRoute?: string,
 *   assemblyPoint?: string,
 *   targetBlock?: string,   // optional — auto-resolved from location if omitted
 *   customMessage?: string, // optional — override the auto-composed message
 * }
 */
router.post('/whatsapp/broadcast', requireAuth, async (req, res) => {
  const {
    incidentId,
    incidentType,
    severity,
    location,
    immediateActions = [],
    evacuationRoute,
    assemblyPoint,
    targetBlock,
    customMessage,
  } = req.body;

  if (!incidentId || !incidentType || !severity || !location) {
    return res.status(400).json({
      error: 'incidentId, incidentType, severity, and location are required.',
    });
  }

  // Resolve which block to alert
  const blockId = targetBlock || resolveBlockFromLocation(location);
  const contacts = getContactsForBlock(blockId);

  if (contacts.length === 0) {
    return res.status(404).json({ error: 'No contacts found for the specified block.' });
  }

  // Compose alert payload
  const alertPayload = {
    incidentType,
    severity,
    location,
    incidentId,
    immediateActions: immediateActions.slice(0, 3),
    evacuationRoute: evacuationRoute || null,
    assemblyPoint: assemblyPoint || 'Convocation Hall & Sangam Arena',
    customMessage: customMessage || null,
  };

  addLog(
    'COM',
    `[WhatsApp] ${req.officer.name} initiated emergency broadcast for ${incidentId} (${severity}) to ${contacts.length} contacts in ${blockId === 'ALL' ? 'ALL blocks' : location}.`
  );

  // Fire off all messages
  const results = await broadcastEmergencyAlert(contacts, alertPayload);

  const sent = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success).length;
  const demoMode = results.some((r) => r.demo);

  const resultLog = addLog(
    'COM',
    `[WhatsApp] Broadcast complete: ${sent} delivered, ${failed} failed. ${demoMode ? '(Demo Mode — not actually sent)' : 'Real messages dispatched.'}`
  );

  res.status(201).json({
    success: true,
    demoMode,
    summary: {
      total: contacts.length,
      sent,
      failed,
      blockId,
      incidentId,
    },
    results: results.map((r) => ({
      contactName: r.contactName,
      role: r.role,
      success: r.success,
      sid: r.sid || null,
      error: r.error || null,
      demo: r.demo || false,
    })),
    log: resultLog,
  });
});

/**
 * POST /api/notifications/whatsapp/send
 * Send alert to a specific list of phone numbers (manual override).
 *
 * Body: {
 *   phones: string[],         // E.164 numbers
 *   message: string,          // custom message body
 *   incidentId?: string,
 * }
 */
router.post('/whatsapp/send', requireAuth, async (req, res) => {
  const { phones, message, incidentId } = req.body;

  if (!phones || !Array.isArray(phones) || phones.length === 0) {
    return res.status(400).json({ error: 'phones array is required.' });
  }
  if (!message || !message.trim()) {
    return res.status(400).json({ error: 'message is required.' });
  }

  addLog('COM', `[WhatsApp] Manual send by ${req.officer.name} to ${phones.length} number(s). Incident: ${incidentId || 'N/A'}.`);

  const results = await Promise.allSettled(
    phones.map((phone) => sendWhatsAppMessage(phone, message.trim()))
  );

  const mapped = results.map((r, i) => ({
    phone: phones[i],
    success: r.status === 'fulfilled' ? r.value.success : false,
    sid: r.status === 'fulfilled' ? r.value.sid : null,
    error: r.status === 'fulfilled' ? r.value.error : r.reason?.message,
    demo: r.status === 'fulfilled' ? r.value.demo : false,
  }));

  const sent = mapped.filter((r) => r.success).length;
  res.status(201).json({ success: true, sent, total: phones.length, results: mapped });
});

/**
 * POST /api/notifications/whatsapp/test
 * Send a test message to verify Twilio credentials.
 * Body: { phone: string }
 */
router.post('/whatsapp/test', requireAuth, async (req, res) => {
  const { phone } = req.body;
  if (!phone) return res.status(400).json({ error: 'phone is required.' });

  const testMsg = `✅ *CampusGuard AI — Test Message*\n\nYour WhatsApp integration is working correctly.\nSent by: ${req.officer.name}\nTime: ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}\n\n_Vignan University Emergency Command System_`;

  const result = await sendWhatsAppMessage(phone, testMsg);

  res.json({
    success: result.success,
    sid: result.sid,
    demo: result.demo || false,
    error: result.error || null,
    message: result.demo
      ? 'Demo mode active — message was not sent. Configure Twilio credentials to enable real delivery.'
      : result.success
      ? 'Test message sent successfully.'
      : `Failed: ${result.error}`,
  });
});

module.exports = router;
