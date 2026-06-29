// ============================================================================
// MICROWAT - Global State & Utilities
// ============================================================================

let currentUser = null;
let currentUserRole = 'user';
let socket = null;
let measurementHistory = [];
let chartInstance = null;
let dashboardChartInstance = null;
let systemParameters = {};

function updateSidebarForRole(role) {
  currentUserRole = role;

  const adminNav = document.getElementById('admin-nav-section');
  if (adminNav) {
    adminNav.classList.toggle('hidden', role !== 'admin');
  }

  const roleBadge = document.getElementById('role-badge');
  if (roleBadge) {
    roleBadge.textContent = role === 'admin' ? 'ADMIN' : 'USER';
    roleBadge.className = role === 'admin'
      ? 'font-label-caps text-[10px] px-xs py-[2px] rounded bg-secondary/20 text-secondary border border-secondary/40'
      : 'font-label-caps text-[10px] px-xs py-[2px] rounded bg-surface-container-highest text-on-surface-variant border border-outline-variant';
  }
}

const safeStorage = {
  getItem: (key) => {
    try { return localStorage.getItem(key); }
    catch (e) { return null; }
  },
  setItem: (key, value) => {
    try { localStorage.setItem(key, value); return true; }
    catch (e) { return false; }
  },
  removeItem: (key) => {
    try { localStorage.removeItem(key); return true; }
    catch (e) { return false; }
  }
};

function updateSystemStatus(type, status) {
  const isOnline = status === 'online';

  if (type === 'hardware') {
    const el = document.getElementById('hardware-status');
    if (el) {
      el.textContent = isOnline ? '🟢 Online' : '🔴 Offline';
      el.className = isOnline ? 'text-tertiary' : 'text-outline';
    }
    const dot = document.getElementById('system-status');
    const text = document.getElementById('system-status-text');
    if (dot) {
      dot.className = `w-2 h-2 rounded-full ${isOnline ? 'bg-tertiary' : 'bg-outline'}`;
    }
    if (text) {
      text.textContent = isOnline ? 'Online' : 'Offline';
      text.className = `font-label-caps text-label-caps ${isOnline ? 'text-tertiary' : 'text-on-surface-variant'}`;
    }
  }

  if (type === 'mqtt') {
    const el = document.getElementById('mqtt-status');
    if (el) {
      el.textContent = isOnline ? '🟢 Online' : '🔴 Offline';
      el.className = isOnline ? 'text-tertiary' : 'text-outline';
    }
  }
}
