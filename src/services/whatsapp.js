/**
 * CampusGuard AI — WhatsApp Emergency Notification Service
 *
 * Uses Twilio's WhatsApp Business API to send real-time emergency alerts.
 *
 * Required environment variables (set in backend/.env):
 *   TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
 *   TWILIO_AUTH_TOKEN=your_auth_token
 *   TWILIO_WHATSAPP_FROM=whatsapp:+14155238886   (Twilio Sandbox number)
 *
 * Sandbox setup (free, no approval needed):
 *   1. Sign up at twilio.com → Console → Messaging → Try it out → Send a WhatsApp message
 *   2. Each recipient WhatsApps "join <keyword>" to +1 415 523 8886 once
 *   3. Then they receive messages from the sandbox
 *
 * Production: Replace sandbox number with an approved WhatsApp Business number.
 */

let twilioClient = null;

function getTwilioClient() {
  if (twilioClient) return twilioClient;

  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;

  if (!sid || !token || sid.startsWith('AC_PLACEHOLDER') || token === 'your_auth_token') {
    return null; // Not configured
  }

  try {
    const twilio = require('twilio');
    twilioClient = twilio(sid, token);
    return twilioClient;
  } catch (err) {
    console.error('[WhatsApp] Failed to initialize Twilio client:', err.message);
    return null;
  }
}

/**
 * Compose the emergency WhatsApp message body.
 */
function composeMessage({ incidentType, severity, location, incidentId, immediateActions, evacuationRoute, assemblyPoint }) {
  const severityEmoji = severity === 'CRITICAL' ? '🔴' : severity === 'HIGH' ? '🟠' : '🟡';
  const typeEmoji = incidentType.toLowerCase().includes('fire') ? '🔥'
    : incidentType.toLowerCase().includes('medical') ? '🚑'
    : incidentType.toLowerCase().includes('security') ? '🚨'
    : incidentType.toLowerCase().includes('structural') ? '🏗️'
    : '⚠️';

  let msg = `${typeEmoji} *CAMPUS EMERGENCY ALERT*\n`;
  msg += `━━━━━━━━━━━━━━━━━━━━\n`;
  msg += `${severityEmoji} *Severity:* ${severity}\n`;
  msg += `📍 *Location:* ${location}\n`;
  msg += `🆔 *Incident:* ${incidentId}\n`;
  msg += `━━━━━━━━━━━━━━━━━━━━\n`;
  msg += `*Incident Type:* ${incidentType}\n\n`;

  if (immediateActions && immediateActions.length > 0) {
    msg += `*Immediate Instructions:*\n`;
    immediateActions.slice(0, 3).forEach((action, i) => {
      msg += `${i + 1}. ${action}\n`;
    });
    msg += '\n';
  }

  if (evacuationRoute) {
    msg += `🚶 *Evacuation Route:*\n${evacuationRoute}\n\n`;
  }

  if (assemblyPoint) {
    msg += `🏛️ *Assembly Point:* ${assemblyPoint}\n\n`;
  }

  msg += `━━━━━━━━━━━━━━━━━━━━\n`;
  msg += `_This is an automated alert from CampusGuard AI Emergency System — Vignan University. Follow all instructions from emergency personnel on site._\n`;
  msg += `_Do NOT re-enter the building until cleared by security._`;

  return msg;
}

/**
 * Send a WhatsApp message to a single phone number.
 * Returns { success, phone, sid?, error? }
 */
async function sendWhatsAppMessage(toPhone, messageBody, fromNumber) {
  const client = getTwilioClient();

  if (!client) {
    // Simulate in demo mode
    console.log(`[WhatsApp DEMO] Would send to ${toPhone}:\n${messageBody}`);
    return { success: true, phone: toPhone, sid: `DEMO-${Date.now()}`, demo: true };
  }

  const from = fromNumber || process.env.TWILIO_WHATSAPP_FROM || 'whatsapp:+14155238886';
  const to = toPhone.startsWith('whatsapp:') ? toPhone : `whatsapp:${toPhone}`;

  try {
    const message = await client.messages.create({
      from,
      to,
      body: messageBody,
    });
    return { success: true, phone: toPhone, sid: message.sid };
  } catch (err) {
    console.error(`[WhatsApp] Failed to send to ${toPhone}:`, err.message);
    return { success: false, phone: toPhone, error: err.message };
  }
}

/**
 * Broadcast an emergency alert to a list of contacts.
 * Returns array of results with per-contact delivery status.
 */
async function broadcastEmergencyAlert(contacts, alertPayload) {
  const messageBody = composeMessage(alertPayload);

  const results = await Promise.allSettled(
    contacts.map((contact) =>
      sendWhatsAppMessage(contact.phone, messageBody)
        .then((r) => ({ ...r, contactId: contact.id, contactName: contact.name, role: contact.role }))
    )
  );

  return results.map((r) =>
    r.status === 'fulfilled' ? r.value : { success: false, error: r.reason?.message || 'Unknown error' }
  );
}

module.exports = {
  sendWhatsAppMessage,
  broadcastEmergencyAlert,
  composeMessage,
  getTwilioClient,
};
