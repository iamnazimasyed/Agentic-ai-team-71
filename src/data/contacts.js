/**
 * Campus Emergency Contact Registry
 *
 * Maps each campus block to the people assigned/present there.
 * In production this would be pulled from a student/staff database.
 * Phone numbers MUST be in E.164 format (+91XXXXXXXXXX for India).
 *
 * To add real numbers: edit the `phone` field for each contact.
 * For Twilio Sandbox testing, every recipient must first send
 * "join <sandbox-keyword>" to +1 415 523 8886 on WhatsApp.
 */

const campusContacts = [
  // ── U-Block (Aryabhatta) ──────────────────────────────────────────
  {
    id: 'CT-001',
    name: 'Dr. Ravi Kumar',
    role: 'Faculty – ECE Department',
    phone: '+910000000001',   // ← replace with real number
    block: 'u_block',
    blockName: 'U-Block (Aryabhatta)',
    floor: 2,
  },
  {
    id: 'CT-002',
    name: 'Priya Sharma',
    role: 'Lab Technician',
    phone: '+910000000002',
    block: 'u_block',
    blockName: 'U-Block (Aryabhatta)',
    floor: 2,
  },
  {
    id: 'CT-003',
    name: 'Arjun Reddy',
    role: 'PG Research Scholar',
    phone: '+910000000003',
    block: 'u_block',
    blockName: 'U-Block (Aryabhatta)',
    floor: 3,
  },

  // ── A-Block (Admin & Academics) ───────────────────────────────────
  {
    id: 'CT-004',
    name: 'Prof. Anand Nair',
    role: 'Vice-Chancellor Office',
    phone: '+910000000004',
    block: 'a_block',
    blockName: 'A-Block (Main Admin)',
    floor: 2,
  },
  {
    id: 'CT-005',
    name: 'Sunita Patel',
    role: 'Administrative Staff',
    phone: '+910000000005',
    block: 'a_block',
    blockName: 'A-Block (Main Admin)',
    floor: 1,
  },

  // ── H-Block (Engineering & Mechatronics) ──────────────────────────
  {
    id: 'CT-006',
    name: 'Dr. Suresh Babu',
    role: 'Faculty – Mechanical Engineering',
    phone: '+910000000006',
    block: 'h_block',
    blockName: 'H-Block (Engineering)',
    floor: 1,
  },
  {
    id: 'CT-007',
    name: 'Kiran Rao',
    role: 'Lab Supervisor',
    phone: '+910000000007',
    block: 'h_block',
    blockName: 'H-Block (Engineering)',
    floor: 0,
  },

  // ── NTR Library ───────────────────────────────────────────────────
  {
    id: 'CT-008',
    name: 'Meena Krishnan',
    role: 'Head Librarian',
    phone: '+910000000008',
    block: 'ntr_library',
    blockName: 'NTR-Vignan Central Library',
    floor: 0,
  },
  {
    id: 'CT-009',
    name: 'Rahul Verma',
    role: 'Student',
    phone: '+910000000009',
    block: 'ntr_library',
    blockName: 'NTR-Vignan Central Library',
    floor: 2,
  },

  // ── Pharmacy College ──────────────────────────────────────────────
  {
    id: 'CT-010',
    name: 'Dr. Lakshmi Devi',
    role: 'Faculty – Pharmaceutical Sciences',
    phone: '+910000000010',
    block: 'pharmacy_block',
    blockName: 'Pharmacy College',
    floor: 2,
  },

  // ── Emergency Response Team (always notified) ─────────────────────
  {
    id: 'CT-100',
    name: 'Cmdr. Marcus Vance',
    role: 'Campus Incident Commander',
    phone: '+910000000100',
    block: 'ALL',
    blockName: 'All Blocks',
    floor: null,
  },
  {
    id: 'CT-101',
    name: 'Security Control Room',
    role: 'Campus Security HQ',
    phone: '+910000000101',
    block: 'ALL',
    blockName: 'All Blocks',
    floor: null,
  },
];

/**
 * Get contacts for a specific block (plus ALL-block emergency contacts).
 * Pass block='ALL' to get every contact.
 */
function getContactsForBlock(blockId) {
  if (!blockId || blockId === 'ALL') return campusContacts;
  return campusContacts.filter(
    (c) => c.block === blockId || c.block === 'ALL'
  );
}

/**
 * Keyword → block ID mapping (extracted from location strings).
 */
function resolveBlockFromLocation(locationText) {
  const t = locationText.toLowerCase();
  if (t.includes('u-block') || t.includes('u block') || t.includes('aryabhatta') || t.includes('u-204')) return 'u_block';
  if (t.includes('library') || t.includes('ntr')) return 'ntr_library';
  if (t.includes('a-block') || t.includes('a block') || t.includes('admin')) return 'a_block';
  if (t.includes('h-block') || t.includes('h block') || t.includes('engineering')) return 'h_block';
  if (t.includes('pharmacy') || t.includes('pharma')) return 'pharmacy_block';
  if (t.includes('convocation') || t.includes('sangam')) return 'convocation_sangam';
  return 'ALL'; // Broadcast to everyone if location unclear
}

module.exports = { campusContacts, getContactsForBlock, resolveBlockFromLocation };
