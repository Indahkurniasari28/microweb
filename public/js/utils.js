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

// ─── Spectral Data Generation ────────────────────────────────────────────────
// Profil spektrum realistis berdasarkan karakteristik dye UV-Vis nyata.
// Setiap dye punya beberapa pita absorbansi (UV + visible), bukan cuma 1 puncak.
const SPECTRAL_PROFILES = {
  rc: { // Congo Red  λmax = 493 nm
    initialAbs: 0.38,
    bands: [
      { w: 224, s: 18, r: 1.95 }, // UV – cincin naftalen & azo konjugasi
      { w: 340, s: 30, r: 0.45 }, // Bahu UV-Vis (transisi n→π* azo)
      { w: 493, s: 36, r: 1.00 }  // Puncak visible utama (merah)
    ]
  },
  mg: { // Malachite Green  λmax = 621 nm
    initialAbs: 0.50,
    bands: [
      { w: 216, s: 15, r: 1.40 }, // UV – cincin fenol tersubstitusi
      { w: 423, s: 34, r: 0.42 }, // Pita visible sekunder (karakteristik MG)
      { w: 621, s: 28, r: 1.00 }  // Puncak visible utama (hijau)
    ]
  },
  mb: { // Methylene Blue  λmax = 664 nm
    initialAbs: 0.60,
    bands: [
      { w: 210, s: 14, r: 1.20 }, // UV
      { w: 292, s: 20, r: 0.40 }, // Near-UV (tiazin ring)
      { w: 614, s: 22, r: 0.72 }, // Bahu visible (dimer MB)
      { w: 664, s: 26, r: 1.00 }  // Puncak visible utama (biru)
    ]
  }
};

// Faktor peluruhan absorbansi per siklus (sesuai kurva MWUV dari docx)
const DEGRADATION_DECAY = [1.0, 0.55, 0.30, 0.15, 0.05];
const DEGRADATION_TIME_POINTS = [0, 15, 30, 45, 60];

/**
 * Menghasilkan data spektrum UV-Vis yang realistis untuk satu siklus pengukuran.
 * Tiap dye punya beberapa pita absorbansi sehingga kurva naik-turun, bukan
 * hanya satu bukit tunggal di tengah.
 *
 * @param {string} wt  - jenis limbah: 'rc' | 'mg' | 'mb'
 * @param {number} timePointMin - waktu siklus: 0 | 15 | 30 | 45 | 60
 * @param {number[]} wavelengths - array panjang gelombang (nm)
 * @returns {number[]} array nilai absorbansi
 */
function generateSpectrum(wt, timePointMin, wavelengths) {
  const profile = SPECTRAL_PROFILES[wt] || SPECTRAL_PROFILES.mb;
  const stepIdx = DEGRADATION_TIME_POINTS.indexOf(timePointMin);
  const decay   = stepIdx >= 0 ? DEGRADATION_DECAY[stepIdx] : DEGRADATION_DECAY[0];

  return wavelengths.map((w, i) => {
    // Jumlahkan kontribusi setiap pita absorbansi (Gaussian)
    let abs = profile.bands.reduce((sum, b) => {
      return sum + b.r * profile.initialAbs * decay *
        Math.exp(-Math.pow(w - b.w, 2) / (2 * b.s * b.s));
    }, 0);

    // Ripple deterministik kecil — simulasi noise baseline instrumen
    // (naik-turun halus di seluruh panjang gelombang, bukan random)
    abs += 0.006 * Math.sin(w * 0.28 + i * 0.11);

    return Math.round(abs * 10000) / 10000;
  });
}
// ─────────────────────────────────────────────────────────────────────────────

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
