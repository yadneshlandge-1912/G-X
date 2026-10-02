/**
 * useAuthStore — Authentication & User Management
 *
 * Handles:
 *  - Per-role login with username + password
 *  - Session persistence via localStorage
 *  - User profile management
 *  - Admin user CRUD
 *  - Notification store
 *  - Theme (dark / light)
 *  - System settings (thresholds, alert rules)
 *  - Shift log entries
 *  - Incident reports
 *  - Equipment checklist
 */
import { create } from 'zustand';

// ─── Seed credentials ───────────────────────────────────────────────────────
// In production replace with backend JWT auth. Passwords shown for demo only.
const SEED_USERS = [
  // Miners
  { id: 'u1', role: 'miner',      username: 'rajan.kumar',  password: 'miner123',    name: 'Rajan Kumar',    badge: 'MN-001', shift: 'Morning', section: 'SEC-A', nodeId: 1, avatar: '👷', phone: '9876543201', joined: '2024-01-10' },
  { id: 'u2', role: 'miner',      username: 'deepak.singh', password: 'miner456',    name: 'Deepak Singh',   badge: 'MN-002', shift: 'Morning', section: 'SEC-A', nodeId: 2, avatar: '👷', phone: '9876543202', joined: '2024-02-15' },
  { id: 'u3', role: 'miner',      username: 'amit.verma',   password: 'miner789',    name: 'Amit Verma',     badge: 'MN-003', shift: 'Evening', section: 'SEC-A', nodeId: 3, avatar: '👷', phone: '9876543203', joined: '2024-03-20' },
  { id: 'u4', role: 'miner',      username: 'suresh.pal',   password: 'miner321',    name: 'Suresh Pal',     badge: 'MN-004', shift: 'Evening', section: 'SEC-A', nodeId: 4, avatar: '👷', phone: '9876543204', joined: '2024-04-05' },
  { id: 'u5', role: 'miner',      username: 'mohan.das',    password: 'miner654',    name: 'Mohan Das',      badge: 'MN-005', shift: 'Night',   section: 'SEC-A', nodeId: 5, avatar: '👷', phone: '9876543205', joined: '2024-05-11' },
  // Supervisors
  { id: 'u6', role: 'supervisor', username: 'vikas.sharma', password: 'super123',    name: 'Vikas Sharma',   badge: 'SV-001', shift: 'Morning', section: 'SEC-A', nodeId: null, avatar: '👨‍💼', phone: '9876543206', joined: '2023-06-01' },
  { id: 'u7', role: 'supervisor', username: 'priya.nair',   password: 'super456',    name: 'Priya Nair',     badge: 'SV-002', shift: 'Evening', section: 'SEC-A', nodeId: null, avatar: '👩‍💼', phone: '9876543207', joined: '2023-07-15' },
  // Rescue
  { id: 'u8', role: 'rescue',     username: 'arjun.rescue', password: 'rescue123',   name: 'Arjun Meena',    badge: 'RS-001', shift: 'On-Call', section: 'SEC-A', nodeId: null, avatar: '🦺', phone: '9876543208', joined: '2023-08-20' },
  { id: 'u9', role: 'rescue',     username: 'sunita.rescue',password: 'rescue456',   name: 'Sunita Bose',    badge: 'RS-002', shift: 'On-Call', section: 'SEC-A', nodeId: null, avatar: '🦺', phone: '9876543209', joined: '2023-09-01' },
  // Admin
  { id: 'u10',role: 'admin',      username: 'admin',        password: 'admin@mine1', name: 'Admin Controller',badge:'AD-001', shift: 'All',     section: 'ALL',   nodeId: null, avatar: '🛡️', phone: '9876543210', joined: '2023-01-01' },
];

// ─── Default system settings ─────────────────────────────────────────────────
const DEFAULT_SETTINGS = {
  gasThreshold:    { caution: 100, warning: 300, danger: 500 },
  tempThreshold:   { caution: 33, warning: 37, danger: 40 },
  humidThreshold:  { caution: 80, warning: 90, danger: 95 },
  nodeTimeoutSec:  60,
  alertSoundEnabled: true,
  autoAckAfterMin: 30,
  loraFreqMHz:     915,
  loraSF:          12,
  loraTxPower:     20,
  mineSectionName: 'SEC-A',
  maxNodes:        5,
  language:        'en',
};

// ─── Helpers ─────────────────────────────────────────────────────────────────
function loadFromStorage(key, fallback) {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; }
  catch { return fallback; }
}
function saveToStorage(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
}

// Always ensure SEED_USERS are present — merges saved users with seeds
// so adding new seed accounts never breaks existing sessions.
function loadUsers() {
  const saved = loadFromStorage('mg_users', []);
  // Build a map of saved users keyed by id
  const savedMap = {};
  saved.forEach(u => { savedMap[u.id] = u; });
  // Seed users fill in any missing entries (e.g. admin was never saved)
  SEED_USERS.forEach(u => {
    if (!savedMap[u.id]) savedMap[u.id] = u;
  });
  return Object.values(savedMap);
}

// ─── Store ───────────────────────────────────────────────────────────────────
const useAuthStore = create((set, get) => ({

  // ── Auth state ────────────────────────────────────────
  currentUser: loadFromStorage('mg_user', null),
  authError:   null,
  // Restore to 'app' if a valid session exists in localStorage, else start at role_pick
  authStep: loadFromStorage('mg_user', null) ? 'app' : 'role_pick',

  // ── Users list (admin-managed) ────────────────────────
  users: loadUsers(),

  // ── Notifications ─────────────────────────────────────
  notifications: loadFromStorage('mg_notifications', []),

  // ── Theme ─────────────────────────────────────────────
  theme: loadFromStorage('mg_theme', 'dark'),   // 'dark' | 'light'

  // ── Settings ──────────────────────────────────────────
  settings: loadFromStorage('mg_settings', DEFAULT_SETTINGS),

  // ── Shift log ─────────────────────────────────────────
  shiftLog: loadFromStorage('mg_shiftlog', [
    { id: 's1', author: 'Vikas Sharma', role: 'supervisor', timestamp: Date.now() - 3600000 * 8,
      shift: 'Morning', content: 'Node 3 reported elevated gas PPM (310) at 06:45. Ventilation fan #2 activated. Situation normalised by 07:15.', type: 'handover' },
    { id: 's2', author: 'Priya Nair',   role: 'supervisor', timestamp: Date.now() - 3600000 * 4,
      shift: 'Morning', content: 'All 5 nodes operational. No SOS events. Gateway rebooted once due to power fluctuation. Backup battery held for 12 min.', type: 'note' },
  ]),

  // ── Incident reports ──────────────────────────────────
  incidents: loadFromStorage('mg_incidents', [
    { id: 'i1', reportedBy: 'Vikas Sharma', role: 'supervisor', nodeId: 3, timestamp: Date.now() - 3600000 * 24,
      type: 'GAS_LEAK', severity: 'HIGH', description: 'Gas PPM exceeded 500 at Node 3 tunnel junction. Area evacuated for 35 minutes. Ventilation increase resolved issue.', status: 'RESOLVED', actionTaken: 'Ventilation fan speed increased. Area cleared and re-entered after 30-min monitoring.' },
  ]),

  // ── Equipment checklist ───────────────────────────────
  equipment: loadFromStorage('mg_equipment', [
    { id: 'eq1',  name: 'Gateway ESP32 (Heltec v2)',   status: 'OK',       lastCheck: Date.now() - 3600000,     assignedTo: 'Admin',         type: 'electronics' },
    { id: 'eq2',  name: 'Node 1 Wearable',             status: 'OK',       lastCheck: Date.now() - 7200000,     assignedTo: 'Rajan Kumar',   type: 'wearable' },
    { id: 'eq3',  name: 'Node 2 Wearable',             status: 'OK',       lastCheck: Date.now() - 7200000,     assignedTo: 'Deepak Singh',  type: 'wearable' },
    { id: 'eq4',  name: 'Node 3 Wearable',             status: 'WARNING',  lastCheck: Date.now() - 86400000,    assignedTo: 'Amit Verma',    type: 'wearable' },
    { id: 'eq5',  name: 'Node 4 Wearable',             status: 'OK',       lastCheck: Date.now() - 7200000,     assignedTo: 'Suresh Pal',    type: 'wearable' },
    { id: 'eq6',  name: 'Node 5 Wearable',             status: 'OK',       lastCheck: Date.now() - 7200000,     assignedTo: 'Mohan Das',     type: 'wearable' },
    { id: 'eq7',  name: 'Ventilation Fan #1',          status: 'OK',       lastCheck: Date.now() - 43200000,    assignedTo: 'Maintenance',   type: 'infrastructure' },
    { id: 'eq8',  name: 'Ventilation Fan #2',          status: 'OK',       lastCheck: Date.now() - 43200000,    assignedTo: 'Maintenance',   type: 'infrastructure' },
    { id: 'eq9',  name: 'Emergency Backup Battery',    status: 'OK',       lastCheck: Date.now() - 86400000,    assignedTo: 'Admin',         type: 'power' },
    { id: 'eq10', name: 'MQ-2 Gas Sensor (Spare)',     status: 'CRITICAL', lastCheck: Date.now() - 172800000,   assignedTo: 'Maintenance',   type: 'sensor' },
    { id: 'eq11', name: 'SOS Buzzer Unit (Spare)',     status: 'OK',       lastCheck: Date.now() - 86400000,    assignedTo: 'Rescue Team',   type: 'safety' },
    { id: 'eq12', name: 'First Aid Kit (Tunnel A)',    status: 'OK',       lastCheck: Date.now() - 604800000,   assignedTo: 'Arjun Meena',   type: 'safety' },
  ]),

  // ────────────────────────────────────────────────────────
  // AUTH ACTIONS
  // ────────────────────────────────────────────────────────

  setAuthStep(step) { set({ authStep: step, authError: null }); },

  login(username, password) {
    const users = get().users;
    const user = users.find(u => u.username === username && u.password === password);
    if (!user) {
      set({ authError: 'Invalid username or password. Please try again.' });
      return false;
    }
    const session = { ...user, loginAt: Date.now() };
    saveToStorage('mg_user', session);
    set({ currentUser: session, authError: null, authStep: 'app' });
    get().pushNotification({
      title: 'Login Successful',
      message: `Welcome back, ${user.name}. Logged in as ${user.role}.`,
      type: 'info',
    });
    return true;
  },

  logout() {
    saveToStorage('mg_user', null);
    set({ currentUser: null, authStep: 'role_pick', authError: null });
  },

  clearAuthError() { set({ authError: null }); },

  // ────────────────────────────────────────────────────────
  // PROFILE ACTIONS
  // ────────────────────────────────────────────────────────

  updateProfile(fields) {
    const cur = get().currentUser;
    if (!cur) return;
    const updated = { ...cur, ...fields };
    // update in users list too
    const users = get().users.map(u => u.id === cur.id ? { ...u, ...fields } : u);
    saveToStorage('mg_user', updated);
    saveToStorage('mg_users', users);
    set({ currentUser: updated, users });
  },

  // ────────────────────────────────────────────────────────
  // ADMIN USER MANAGEMENT
  // ────────────────────────────────────────────────────────

  addUser(newUser) {
    const user = { ...newUser, id: `u${Date.now()}`, joined: new Date().toISOString().split('T')[0] };
    const users = [...get().users, user];
    saveToStorage('mg_users', users);
    set({ users });
  },

  updateUser(id, fields) {
    const users = get().users.map(u => u.id === id ? { ...u, ...fields } : u);
    saveToStorage('mg_users', users);
    set({ users });
  },

  deleteUser(id) {
    const users = get().users.filter(u => u.id !== id);
    saveToStorage('mg_users', users);
    set({ users });
  },

  // ────────────────────────────────────────────────────────
  // NOTIFICATIONS
  // ────────────────────────────────────────────────────────

  pushNotification({ title, message, type = 'info' }) {
    const notif = { id: `n${Date.now()}`, title, message, type, ts: Date.now(), read: false };
    const notifications = [notif, ...get().notifications].slice(0, 50);
    saveToStorage('mg_notifications', notifications);
    set({ notifications });
  },

  markNotifRead(id) {
    const notifications = get().notifications.map(n => n.id === id ? { ...n, read: true } : n);
    saveToStorage('mg_notifications', notifications);
    set({ notifications });
  },

  markAllNotifsRead() {
    const notifications = get().notifications.map(n => ({ ...n, read: true }));
    saveToStorage('mg_notifications', notifications);
    set({ notifications });
  },

  clearNotifications() {
    saveToStorage('mg_notifications', []);
    set({ notifications: [] });
  },

  // ────────────────────────────────────────────────────────
  // THEME
  // ────────────────────────────────────────────────────────

  toggleTheme() {
    const theme = get().theme === 'dark' ? 'light' : 'dark';
    saveToStorage('mg_theme', theme);
    set({ theme });
    if (typeof document !== 'undefined') {
      document.documentElement.classList.toggle('light-mode', theme === 'light');
      document.documentElement.classList.toggle('dark', theme !== 'light');
    }
  },

  // ────────────────────────────────────────────────────────
  // SETTINGS
  // ────────────────────────────────────────────────────────

  updateSettings(partial) {
    const settings = { ...get().settings, ...partial };
    saveToStorage('mg_settings', settings);
    set({ settings });
  },

  // ────────────────────────────────────────────────────────
  // SHIFT LOG
  // ────────────────────────────────────────────────────────

  addShiftEntry(content, type = 'note') {
    const cur = get().currentUser;
    if (!cur) return;
    const entry = {
      id: `s${Date.now()}`,
      author: cur.name,
      role: cur.role,
      shift: cur.shift,
      timestamp: Date.now(),
      content,
      type,
    };
    const shiftLog = [entry, ...get().shiftLog].slice(0, 100);
    saveToStorage('mg_shiftlog', shiftLog);
    set({ shiftLog });
  },

  // ────────────────────────────────────────────────────────
  // INCIDENTS
  // ────────────────────────────────────────────────────────

  fileIncident({ nodeId, type, severity, description }) {
    const cur = get().currentUser;
    if (!cur) return;
    const incident = {
      id: `i${Date.now()}`,
      reportedBy: cur.name,
      role: cur.role,
      nodeId,
      timestamp: Date.now(),
      type,
      severity,
      description,
      status: 'OPEN',
      actionTaken: '',
    };
    const incidents = [incident, ...get().incidents];
    saveToStorage('mg_incidents', incidents);
    set({ incidents });
  },

  updateIncident(id, fields) {
    const incidents = get().incidents.map(i => i.id === id ? { ...i, ...fields } : i);
    saveToStorage('mg_incidents', incidents);
    set({ incidents });
  },

  // ────────────────────────────────────────────────────────
  // EQUIPMENT
  // ────────────────────────────────────────────────────────

  updateEquipment(id, fields) {
    const equipment = get().equipment.map(e => e.id === id ? { ...e, ...fields, lastCheck: Date.now() } : e);
    saveToStorage('mg_equipment', equipment);
    set({ equipment });
  },

  addEquipment(item) {
    const eq = { ...item, id: `eq${Date.now()}`, lastCheck: Date.now() };
    const equipment = [...get().equipment, eq];
    saveToStorage('mg_equipment', equipment);
    set({ equipment });
  },
}));

export default useAuthStore;
