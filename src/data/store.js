/**
 * In-memory data store — seeded with the same data as the frontend mockData.ts.
 * All routes mutate this shared store so changes persist across requests
 * (within a single server session).
 */

const { v4: uuidv4 } = require('uuid');

// ─── Incidents ───────────────────────────────────────────────────────────────
const incidents = [
  {
    id: 'INC-1024',
    type: 'Fire Alarm',
    location: 'U-Block (Aryabhatta), Lab U-204',
    severity: 'CRITICAL',
    status: 'Active',
    reportedTime: '14:02',
    teams: 'Hazmat Alpha, Fire Unit 4',
    coordinates: { lat: 16.2333, lng: 80.55101 },
    telemetry: {
      tempZoneA: '145°C ↑',
      smokeDensity: '85%',
      sprinklers: 'Deployed',
      evacStatus: '98% Clear',
      containmentProb: '42% probability spread',
      occupancyEst: '14 Personnel',
      hazmatRisk: 'HIGH (Class 3 Flammables)',
    },
  },
  {
    id: 'INC-1023',
    type: 'Unauthorized Access',
    location: 'Aryabhata Server Center',
    severity: 'HIGH',
    status: 'Active',
    reportedTime: '13:45',
    teams: 'Security Team 2',
    coordinates: { lat: 16.233, lng: 80.551 },
    telemetry: {
      tempZoneA: '21°C',
      smokeDensity: '0%',
      sprinklers: 'Standby',
      evacStatus: 'Access Locked',
    },
  },
  {
    id: 'INC-1022',
    type: 'Camera Offline',
    location: 'Main Gate (Guntur-Tenali Rd)',
    severity: 'LOW',
    status: 'Monitoring',
    reportedTime: '11:30',
    teams: 'IT Ops',
    coordinates: { lat: 16.2319, lng: 80.5508 },
    telemetry: {
      tempZoneA: '24°C',
      smokeDensity: '0%',
      sprinklers: 'Standby',
      evacStatus: 'Normal',
    },
  },
  {
    id: 'INC-1021',
    type: 'Medical Assist',
    location: 'NTR Vignan Library, 2nd Floor',
    severity: 'HIGH',
    status: 'Resolved',
    reportedTime: '09:15',
    teams: 'Medic Unit 1',
    coordinates: { lat: 16.2341, lng: 80.5524 },
    telemetry: {
      tempZoneA: '22°C',
      smokeDensity: '0%',
      sprinklers: 'Standby',
      evacStatus: 'Triage Complete',
    },
  },
  {
    id: 'INC-1020',
    type: 'Perimeter Breach',
    location: 'North Campus Perimeter (Vadlamudi Gate)',
    severity: 'HIGH',
    status: 'Active',
    reportedTime: '14:00',
    teams: 'Patrol Alpha, UAV-1',
    coordinates: { lat: 16.2345, lng: 80.5515 },
    telemetry: {
      tempZoneA: '23°C',
      smokeDensity: '0%',
      sprinklers: 'Standby',
      evacStatus: 'Perimeter Alert',
    },
  },
  {
    id: 'INC-1019',
    type: 'HVAC Malfunction',
    location: 'Engineering Workshops Hub Wing D',
    severity: 'MEDIUM',
    status: 'Monitoring',
    reportedTime: '08:40',
    teams: 'Facilities Team 3',
    coordinates: { lat: 16.2325, lng: 80.553 },
    telemetry: {
      tempZoneA: '28°C',
      smokeDensity: '5%',
      sprinklers: 'Standby',
      evacStatus: 'Normal',
    },
  },
];

// ─── Resources ────────────────────────────────────────────────────────────────
const resources = [
  {
    id: 'AMB-042',
    type: 'ALS Ambulance',
    category: 'Ambulances',
    location: 'North Quad Sector 7',
    status: 'DEPLOYED',
    assignedIncident: 'INC-992 (Medical)',
    distance: '0.2 km',
    operator: 'Paramedic Team 4',
  },
  {
    id: 'SEC-T12',
    type: 'Tactical Response',
    category: 'Security Teams',
    location: 'Transit Corridor B',
    status: 'EN ROUTE',
    assignedIncident: 'INC-994 (Disturbance)',
    distance: '1.4 km',
    operator: 'Officer Jackson / Ramirez',
  },
  {
    id: 'MED-009',
    type: 'Triage Team Alpha',
    category: 'Medical Teams',
    location: 'Central Medical Hub',
    status: 'AVAILABLE',
    assignedIncident: '--',
    distance: '2.1 km',
    operator: 'Dr. Chen & Field Medics',
  },
  {
    id: 'FAC-R33',
    type: 'Heavy Maintenance',
    category: 'Facilities',
    location: 'South Engineering Wing',
    status: 'BUSY',
    assignedIncident: 'MNT-102 (Routine)',
    distance: '0.8 km',
    operator: 'Facilities Crew 2',
  },
  {
    id: 'SEC-P04',
    type: 'Patrol Unit',
    category: 'Security Teams',
    location: 'Library Plaza',
    status: 'AVAILABLE',
    assignedIncident: '--',
    distance: '0.5 km',
    operator: 'Officer Davis',
  },
  {
    id: 'ENG-004',
    type: 'Fire Engine E-04',
    category: 'Vehicles',
    location: 'Block C Perimeter',
    status: 'DEPLOYED',
    assignedIncident: 'INC-1024 (Fire)',
    distance: '0.1 km',
    operator: 'Captain Miller / Station 9',
  },
  {
    id: 'DRN-UAV1',
    type: 'Surveillance Drone',
    category: 'Vehicles',
    location: 'Airspace Sector Alpha-V',
    status: 'DEPLOYED',
    assignedIncident: 'INC-1024 (Fire)',
    distance: '0.0 km',
    operator: 'AI Autonomous Guidance',
  },
  {
    id: 'SHL-01',
    type: 'Emergency Shelter A',
    category: 'Shelters',
    location: 'Student Union Basement',
    status: 'AVAILABLE',
    assignedIncident: '--',
    distance: '0.6 km',
    operator: 'Campus Disaster Staff',
  },
];

// ─── AI Agents ────────────────────────────────────────────────────────────────
const agents = [
  {
    id: 'SEC-01',
    code: 'SEC-01',
    name: 'Security Coordination',
    role: 'Perimeter & Asset Defense',
    status: 'ACTIVE',
    currentTask: 'Perimeter Breach Analysis - Sector 4G',
    confidence: 94.2,
    threatLevel: 'Elevated',
    assignedAssets: '12 Cameras, 4 Patrol Officers',
    latestActions: [
      { time: '14:02:11', text: 'Locked down access points C-12 through C-15.' },
      { time: '14:01:45', text: 'Dispatched Patrol Alpha to Sector 4G.' },
    ],
    requiresApproval: false,
    approvalDraft: null,
  },
  {
    id: 'MED-02',
    code: 'MED-02',
    name: 'Triage',
    role: 'Biometric & Emergency Care',
    status: 'ANALYZING',
    currentTask: 'Evaluating biometric anomalies in chem lab',
    confidence: 89.6,
    threatLevel: 'High',
    assignedAssets: '2 Med Teams, 1 AED Drone',
    latestActions: [
      { time: '13:58:20', text: 'Initiated passive biometric scan of personnel in adjacent zones.' },
    ],
    requiresApproval: false,
    approvalDraft: null,
  },
  {
    id: 'TRN-03',
    code: 'TRN-03',
    name: 'Logistics',
    role: 'Route & Transport Dispatch',
    status: 'ACTIVE',
    currentTask: 'Routing emergency vehicles via Route B',
    confidence: 96.0,
    threatLevel: 'Normal',
    assignedAssets: '3 Shuttles, Gate Controls',
    latestActions: [
      { time: '14:00:05', text: 'Cleared North Gate approach; re-routed transit line 2.' },
    ],
    requiresApproval: false,
    approvalDraft: null,
  },
  {
    id: 'FAC-04',
    code: 'FAC-04',
    name: 'Infrastructure',
    role: 'HVAC, Power & Structural Sensors',
    status: 'STANDBY',
    currentTask: 'Monitoring HVAC integrity and suppression lines',
    confidence: 99.1,
    threatLevel: 'Normal',
    assignedAssets: 'Bldg Sensors, Power Grid',
    latestActions: [
      { time: '13:30:00', text: 'Completed routine pressure diagnostics. All nominal.' },
    ],
    requiresApproval: false,
    approvalDraft: null,
  },
  {
    id: 'COM-05',
    code: 'COM-05',
    name: 'Broadcast',
    role: 'Campus Alerts & Human Notifications',
    status: 'ACTIVE',
    currentTask:
      'Drafting campus-wide SMS alert regarding Sector 4G perimeter breach. Awaiting human confirmation.',
    confidence: 91.5,
    threatLevel: 'Elevated',
    assignedAssets: 'SMS Gateway, Siren Network, PA System',
    latestActions: [
      { time: '14:01:30', text: 'Generated draft communication template TPL-44.' },
    ],
    requiresApproval: true,
    approvalDraft:
      'URGENT: Active security assessment in Sector 4G. All students and staff avoid East Gate entrance. Follow officer directions.',
  },
];

// ─── AI Directives ────────────────────────────────────────────────────────────
const directives = [
  {
    id: 'INC-8924-A',
    incidentId: 'INC-1024',
    title: 'Evacuate Block C',
    risk: 'HIGH',
    timestamp: '14:02:45 UTC',
    confidence: 98.5,
    justification:
      'Thermal anomalous readings in Sub-basement 3 correlated with unauthorized access terminal bypass. Probability of hazardous material breach exceeds safety threshold.',
    recommendedActions: [
      'Sound localized alarms (Block C only)',
      'Lockdown blast doors in Sub-basement',
      'Dispatch hazmat drone Alpha-1',
    ],
    status: 'PENDING',
    signedBy: null,
  },
  {
    id: 'INC-8925-B',
    incidentId: 'INC-1020',
    title: 'Deploy Security Detail',
    risk: 'MED',
    timestamp: '14:05:12 UTC',
    confidence: 82.1,
    justification:
      'Unrecognized vehicle loitering near North Gate perimeter. License plate obscured. Facial recognition on driver inconclusive due to glare.',
    recommendedActions: [
      'Dispatch 2x human security officers',
      'Lockdown blast doors in Sub-basement',
      'Elevate gate perimeter alert level to Yellow',
    ],
    status: 'PENDING',
    signedBy: null,
  },
  {
    id: 'INC-8920-C',
    incidentId: 'INC-1019',
    title: 'Isolate HVAC Sector Wing D',
    risk: 'MED',
    timestamp: '13:42:10 UTC',
    confidence: 95.0,
    justification: 'Differential air pressure detected in fume extraction duct 4B.',
    recommendedActions: ['Seal extraction damper D-4', 'Notify lab manager Dr. Vance'],
    status: 'APPROVED',
    signedBy: 'SIG: CMDR. VANCE (OP-02)',
  },
  {
    id: 'INC-8890-D',
    incidentId: 'INC-1015',
    title: 'Initiate Full Campus Lockdown',
    risk: 'HIGH',
    timestamp: '12:15:33 UTC',
    confidence: 61.2,
    justification: 'False trip wire alarm at sports pavilion during maintenance.',
    recommendedActions: ['Full lockdown protocol across all sectors'],
    status: 'REJECTED',
    signedBy: 'SIG: SUPV. REYNOLDS (OP-01)',
  },
];

// ─── System Logs ──────────────────────────────────────────────────────────────
const systemLogs = [
  { id: '1', timestamp: '14:01:22', level: 'SYS', message: 'Routine telemetry check Sector A-G completed.' },
  {
    id: '2',
    timestamp: '14:02:05',
    level: 'WRN',
    message: 'Smoke detector activation Block C, Level 2. Cross-referencing thermal sensors...',
  },
  {
    id: '3',
    timestamp: '14:02:08',
    level: 'CRIT',
    message: 'Thermal camera CAM-C2-04 confirms rapid heat increase. Incident INC-1024 generated.',
  },
  {
    id: '4',
    timestamp: '14:02:11',
    level: 'AI',
    message: 'Automated Protocol Alpha triggered. Dispatching Fire Engine E-04 (ETA: 4m).',
  },
  {
    id: '5',
    timestamp: '14:02:15',
    level: 'SYS',
    message: 'Locking elevator shafts in Block C. Routing power to emergency lighting.',
  },
];

// ─── Swarm Logs ───────────────────────────────────────────────────────────────
const swarmLogs = [
  {
    id: '10',
    timestamp: '14:02:11',
    level: 'SEC',
    message: 'Executed isolation protocol alpha-7. Locked nodes C12, C13, C14, C15.',
  },
  {
    id: '11',
    timestamp: '14:02:08',
    level: 'SYS',
    message: 'Anomaly detection threshold exceeded in Sector 4G. Confidence: 94.2%.',
  },
  {
    id: '12',
    timestamp: '14:01:45',
    level: 'SEC',
    message: 'Dispatched physical unit Patrol Alpha to intersection 4G-North.',
  },
  {
    id: '13',
    timestamp: '14:01:30',
    level: 'COM',
    message: 'Generated draft communication template TPL-44. Awaiting human verification.',
  },
  {
    id: '14',
    timestamp: '14:00:05',
    level: 'TRN',
    message: 'Re-routed internal shuttle lines away from North Gate approach.',
  },
  {
    id: '15',
    timestamp: '13:58:20',
    level: 'MED',
    message: 'Initiated passive biometric scan of personnel in adjacent zones.',
  },
  { id: '16', timestamp: '13:58:00', level: 'SYS', message: 'Agent synchronization complete. Network latency: 4ms.' },
  { id: '17', timestamp: '13:30:00', level: 'FAC', message: 'Completed routine diagnostics. All nominal.' },
  { id: '18', timestamp: '13:00:00', level: 'SYS', message: 'Hourly state snapshot saved.' },
];

// ─── Officers (users) ─────────────────────────────────────────────────────────
// Passwords are bcrypt hashes of 'password123' for all demo accounts.
const officers = [
  {
    id: 'OPR-8842',
    name: 'Cmdr. Marcus Vance',
    role: 'Campus Incident Commander',
    // bcrypt hash of "password123"
    passwordHash: '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy',
  },
  {
    id: 'DSP-1049',
    name: 'Lt. Sarah Chen',
    role: 'Tactical Dispatch Supervisor',
    passwordHash: '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy',
  },
  {
    id: 'SEC-4021',
    name: 'Officer Vikram Rao',
    role: 'Campus Security & QRF Lead',
    passwordHash: '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy',
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function nowTime() {
  return new Date().toTimeString().split(' ')[0];
}

function makeLog(level, message) {
  return { id: uuidv4(), timestamp: nowTime(), level, message };
}

module.exports = {
  incidents,
  resources,
  agents,
  directives,
  systemLogs,
  swarmLogs,
  officers,
  nowTime,
  makeLog,
};
