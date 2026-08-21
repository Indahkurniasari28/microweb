// ============================================================================
// MICROWAT - Dashboard Page (Firestore-backed)
// ============================================================================
//
// PERUBAHAN UTAMA vs versi lama:
// - Grafik & KPI sekarang diisi dari Firestore (experiments/{id}/cycles),
//   BUKAN dari socket.io 'spectrometerUpdate' / generateSpectrum() simulasi.
// - Tiap dokumen cycle di-listen real-time via onSnapshot -> begitu RPi
//   nulis cycle baru ke Firestore, dashboard browser auto-update.
// - Data yang diterima juga disuntik ke `measurementHistory[]` (global
//   yang sama dipakai analytics.js / history.js / admin.js) supaya
//   halaman-halaman itu ikut menampilkan data asli tanpa perlu diubah.
//
// PRASYARAT DI HTML (tambahkan SEBELUM <script src=".../dashboard.js">,
// di layout/shell utama, bukan di pages/dashboard.html):
//
//   <script src="https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js"></script>
//   <script src="https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore-compat.js"></script>
//
// (compat SDK dipilih karena dashboard.js ini classic script, bukan module —
//  initDashboardPage() dipanggil sbg fungsi global dari navigation.js)
// ============================================================================

// ── Firebase init (microwat-iot project) ──────────────────────────────────
const MICROWAT_FIREBASE_CONFIG = {
  apiKey: "AIzaSyD93tcxcKWxhNoq5sL7S-fiaA9rsA9Tox0",
  authDomain: "microwat-iot.firebaseapp.com",
  projectId: "microwat-iot",
  storageBucket: "microwat-iot.firebasestorage.app",
  messagingSenderId: "565711056431",
  appId: "1:565711056431:web:c7ce39356f2d93675560da"
};

if (typeof firebase === 'undefined') {
  console.error('❌ Firebase compat SDK belum dimuat. Tambahkan script firebase-app-compat.js & firebase-firestore-compat.js SEBELUM dashboard.js');
} else {
  if (!firebase.apps || !firebase.apps.length) {
    firebase.initializeApp(MICROWAT_FIREBASE_CONFIG);
  }
}
const microwatDb = typeof firebase !== 'undefined' ? firebase.firestore() : null;

// ── Konfigurasi eksperimen per jenis limbah ────────────────────────────────
// TODO: isi experimentId Firestore untuk MG dan MB begitu eksperimennya ada.
// Formatnya sama seperti yang dipakai di config.py -> FIREBASE_EXPERIMENT_ID
const WASTEWATER_EXPERIMENT_MAP = {
  rc: 'exp_20260819_001', // Congo Red — sesuai config.py saat ini
  mg: null,                // TODO: experimentId Malachite Green
  mb: null                 // TODO: experimentId Methylene Blue
};

function normalizeCycleRecord(rawCycle = {}, fallbackId = null) {
  const cycle = rawCycle && typeof rawCycle === 'object' ? rawCycle : {};
  const cycleNumber = Number(cycle.cycle ?? cycle.siklus ?? cycle.phase ?? 0);
  const elapsedMinutes = Number(cycle.elapsedMinutes ?? cycle.elapsed_min ?? cycle.elapsed ?? 0);
  const lambdaMax = Number(cycle.lambdaMax ?? cycle.lambda_max ?? cycle.wavelengthMax ?? cycle.wavelength_max ?? NaN);
  const absorbanceMax = Number(cycle.absorbanceMax ?? cycle.absorbance_max ?? cycle.absorbance ?? NaN);
  const wavelengths = Array.isArray(cycle.wavelengths)
    ? cycle.wavelengths
    : Array.isArray(cycle.spectrum)
      ? cycle.spectrum.map(p => Number(p?.wavelength ?? p?.x ?? p?.wl ?? p?.lambda ?? 0)).filter(v => Number.isFinite(v))
      : [];
  const absorbanceValues = Array.isArray(cycle.absorbanceValues)
    ? cycle.absorbanceValues
    : Array.isArray(cycle.spectrum)
      ? cycle.spectrum.map(p => Number(p?.absorbance ?? p?.y ?? p?.value ?? 0)).filter(v => Number.isFinite(v))
      : [];

  return {
    ...cycle,
    id: cycle.id || fallbackId || rawCycle.id || null,
    cycle: Number.isFinite(cycleNumber) ? cycleNumber : 0,
    elapsedMinutes: Number.isFinite(elapsedMinutes) ? elapsedMinutes : null,
    lambdaMax: Number.isFinite(lambdaMax) ? lambdaMax : null,
    absorbanceMax: Number.isFinite(absorbanceMax) ? absorbanceMax : null,
    wavelengths,
    absorbanceValues,
    timestamp: cycle.timestamp || cycle.time || cycle.tanggal || null,
    csvPath: cycle.csvPath || cycle.csvPathLocal || null,
    plotPath: cycle.plotPath || cycle.plotPathLocal || null,
    csvUrl: cycle.csvUrl || cycle.csvDownloadUrl || null,
    plotUrl: cycle.plotUrl || cycle.plotDownloadUrl || null
  };
}

// C₀ (konsentrasi awal, ppm) dipakai untuk hitung konsentrasi via A/A₀ × C₀.
// Sesuaikan dengan konsentrasi larutan awal yang benar-benar kamu pakai.
const INITIAL_CONCENTRATION = 10; // ppm

// Ambang batas SAFE (ppm) — sesuaikan kalau ada standar baku mutu lain.
const SAFE_THRESHOLD_PPM = 5;

const CYCLE_COLORS = {
  0:  '#515151',  // 0 min  - hitam
  15: '#B177DE',  // 15 min - ungu
  30: '#CC9900',  // 30 min - kuning
  45: '#00CBCC',  // 45 min - tosca
  60: '#7D4E4E'   // 60 min - coklat
};
const DASH_TIME_POINTS = [0, 15, 30, 45, 60];

let currentWastewaterType = 'rc';
let baseAbsorbance = null;      // A₀ — absorbanceMax dari cycle 0
let currentDashPhase = -1;      // index cycle tertinggi yang sudah masuk
let cyclesUnsubscribe = null;   // fungsi unsubscribe onSnapshot aktif

// ============================================================================
// INIT
// ============================================================================

function initDashboardPage() {
  console.log('🔧 Init Dashboard (Firestore mode)');

  const banner = document.getElementById('sim-mode-banner');
  if (banner) banner.classList.toggle('hidden', !window.simMode);

  document.querySelectorAll('.wt-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      currentWastewaterType = btn.dataset.wt;
      document.querySelectorAll('.wt-btn').forEach(b => {
        const wt = b.dataset.wt;
        const colors = { rc: '#f87171', mg: '#34d399', mb: '#60a5fa' };
        const c = colors[wt];
        if (b === btn) {
          b.style.background = `rgba(${hexToRgb(c)}, 0.15)`;
          b.style.borderColor = c;
        } else {
          b.style.background = 'transparent';
          b.style.borderColor = `rgba(${hexToRgb(c)}, 0.3)`;
        }
      });
      subscribeDashboardToWastewaterType(currentWastewaterType);
    });
  });

  initDashboardChart();
  subscribeDashboardToWastewaterType(currentWastewaterType);
}

function hexToRgb(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `${r},${g},${b}`;
}

// ============================================================================
// FIRESTORE SUBSCRIPTION
// ============================================================================

function subscribeDashboardToWastewaterType(wt) {
  if (cyclesUnsubscribe) {
    cyclesUnsubscribe();
    cyclesUnsubscribe = null;
  }

  resetDashboardChart();
  baseAbsorbance = null;
  currentDashPhase = -1;
  updateDashPhaseUI();

  const experimentId = WASTEWATER_EXPERIMENT_MAP[wt];
  if (!microwatDb) return;

  if (!experimentId) {
    const phaseText = document.getElementById('dash-phase-text');
    if (phaseText) phaseText.textContent = `Belum ada experimentId untuk jenis limbah ini`;
    updateSystemStatus('hardware', 'offline');
    return;
  }

  const phaseText = document.getElementById('dash-phase-text');
  if (phaseText) phaseText.textContent = `Menunggu data dari ${experimentId}…`;

  cyclesUnsubscribe = microwatDb
    .collection('experiments').doc(experimentId).collection('cycles')
    .orderBy('cycle')
    .onSnapshot(
      snapshot => {
        const cycles = snapshot.docs.map(d => normalizeCycleRecord(d.data(), d.id));
        onCyclesUpdate(experimentId, wt, cycles);
        updateSystemStatus('hardware', 'online');
      },
      err => {
        console.error('Firestore onSnapshot error:', err);
        updateSystemStatus('hardware', 'offline');
      }
    );
}

function onCyclesUpdate(experimentId, wt, cycles) {
  if (!cycles.length) return;

  renderDashboardChartFromCycles(cycles);
  if (typeof renderAnalyticsChartFromCycles === 'function') {
    renderAnalyticsChartFromCycles(cycles);
  }
  updateDashboardKpisFromCycles(experimentId, wt, cycles);
  syncMeasurementHistoryFromCycles(experimentId, wt, cycles);
}

// ============================================================================
// CHART
// ============================================================================

function initDashboardChart() {
  const ctx = document.getElementById('dashboard-chart');
  if (!ctx) return;

  if (dashboardChartInstance) {
    dashboardChartInstance.destroy();
    dashboardChartInstance = null;
  }

  const datasets = DASH_TIME_POINTS.map(tp => ({
    label: `${tp} min`,
    data: [],
    borderColor: CYCLE_COLORS[tp],
    backgroundColor: 'transparent',
    borderWidth: tp === 0 ? 2 : 1.5,
    pointRadius: 0,
    pointHoverRadius: 4,
    tension: 0.1,
    fill: false,
    spanGaps: false,
    parsing: false // data sudah dalam bentuk {x, y}
  }));

  dashboardChartInstance = new Chart(ctx, {
    type: 'line',
    data: { datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          labels: { color: '#a0b4c4', font: { family: 'Poppins', size: 11 } }
        },
        tooltip: {
          callbacks: {
            title: items => `λ = ${items[0].parsed.x} nm`,
            label: item => {
              const y = item.raw?.y;
              return y != null ? ` ${item.dataset.label}: ${Number(y).toFixed(4)} a.u.` : null;
            }
          }
        }
      },
      scales: {
        x: {
          type: 'linear',
          // Rentang data asli spektrometer kamu ~142-1332nm (lihat CSV),
          // bukan 200-800 seperti versi simulasi lama. Sesuaikan lagi kalau perlu.
          min: 140,
          max: 1340,
          ticks: { color: '#4a6070', font: { family: 'Poppins', size: 10 }, stepSize: 100 },
          grid: { color: 'rgba(74, 96, 112, 0.2)' },
          title: { display: true, text: 'Panjang Gelombang (nm)', color: '#a0b4c4', font: { size: 11, family: 'Poppins' } }
        },
        y: {
          ticks: { color: '#7dd3fc', font: { family: 'Poppins', size: 10 } },
          grid: { color: 'rgba(74, 96, 112, 0.2)' },
          title: { display: true, text: 'Absorbansi (a.u.)', color: '#7dd3fc', font: { size: 11, family: 'Poppins' } }
        }
      }
    }
  });

  updateDashPhaseUI();
}

function resetDashboardChart() {
  if (!dashboardChartInstance) { initDashboardChart(); return; }
  dashboardChartInstance.data.datasets.forEach(ds => { ds.data = []; });
  dashboardChartInstance.update('none');
}

function renderDashboardChartFromCycles(cycles) {
  if (!dashboardChartInstance) initDashboardChart();
  if (!dashboardChartInstance) return;

  let maxCycleIdx = -1;

  cycles.forEach(rawCycle => {
    const cycle = normalizeCycleRecord(rawCycle, rawCycle.id);
    const idx = Number.isInteger(cycle.cycle) ? cycle.cycle : DASH_TIME_POINTS.indexOf(cycle.elapsedMinutes);
    if (idx < 0 || idx >= DASH_TIME_POINTS.length) return;
    if (!Array.isArray(cycle.wavelengths) || !Array.isArray(cycle.absorbanceValues)) return;

    const points = cycle.wavelengths
      .map((wl, i) => ({ x: wl, y: cycle.absorbanceValues[i] }))
      .filter(p => Number.isFinite(p.x) && Number.isFinite(p.y));

    dashboardChartInstance.data.datasets[idx].data = points;
    if (idx > maxCycleIdx) maxCycleIdx = idx;
  });

  dashboardChartInstance.update('none');

  if (maxCycleIdx > currentDashPhase) {
    currentDashPhase = maxCycleIdx;
    updateDashPhaseUI();
  }
}

function updateDashPhaseUI() {
  const tp = currentDashPhase >= 0 ? DASH_TIME_POINTS[currentDashPhase] : null;
  const phaseText = document.getElementById('dash-phase-text');
  if (phaseText && tp !== null) {
    phaseText.textContent = `Fase ${currentDashPhase + 1}/5 · ${tp} menit`;
  }

  const dotsContainer = document.getElementById('dash-phase-dots');
  if (dotsContainer) {
    const dots = dotsContainer.querySelectorAll('span');
    DASH_TIME_POINTS.forEach((t, i) => {
      if (dots[i]) dots[i].style.opacity = i <= currentDashPhase ? '1' : '0.2';
    });
  }
}

// ============================================================================
// KPI CARDS
// ============================================================================

function updateDashboardKpisFromCycles(experimentId, wt, cycles) {
  const normalized = cycles.map(c => normalizeCycleRecord(c, c && c.id));
  const sorted = [...normalized].sort((a, b) => (a.cycle ?? 0) - (b.cycle ?? 0));
  const first = sorted[0];
  const latest = sorted[sorted.length - 1];
  if (!latest) return;

  if (first && Number.isFinite(first.absorbanceMax)) {
    baseAbsorbance = first.absorbanceMax;
  }
  const absorbance = Number.isFinite(latest.absorbanceMax) ? latest.absorbanceMax : 0;

  const concentration = baseAbsorbance && baseAbsorbance !== 0
    ? (absorbance / baseAbsorbance) * INITIAL_CONCENTRATION
    : 0;

  const degradation = baseAbsorbance && baseAbsorbance !== 0
    ? Math.max(0, ((baseAbsorbance - absorbance) / baseAbsorbance) * 100)
    : 0;

  const isSafe = concentration <= SAFE_THRESHOLD_PPM;
  const reactionTimeMin = DASH_TIME_POINTS[latest.cycle] ?? latest.elapsedMinutes ?? null;

  // Concentration & degradation
  const concEl = document.getElementById('concentration-value');
  if (concEl) concEl.textContent = concentration.toFixed(2);

  const degEl = document.getElementById('degradation-value');
  if (degEl) degEl.textContent = degradation.toFixed(1) + '%';

  const circle = document.getElementById('degradation-circle');
  if (circle) {
    const circumference = 2 * Math.PI * 24;
    const offset = circumference - (Math.min(degradation, 100) / 100) * circumference;
    circle.style.strokeDashoffset = offset;
  }

  // Safety status
  const safetyBadge = document.getElementById('safety-status-badge');
  if (safetyBadge) {
    if (isSafe) {
      safetyBadge.className = 'mt-xs inline-flex items-center gap-xs px-sm py-xs bg-green-500/10 border border-green-500/30 text-green-400 rounded-lg font-label-caps text-label-caps w-fit';
      safetyBadge.innerHTML = '<span class="w-2 h-2 rounded-full bg-green-500"></span> SAFE';
      safetyBadge.classList.remove('unsafe-blink');
    } else {
      safetyBadge.className = 'mt-xs inline-flex items-center gap-xs px-sm py-xs bg-red-500/10 border border-red-500/30 text-red-400 rounded-lg font-label-caps text-label-caps w-fit unsafe-blink';
      safetyBadge.innerHTML = '<span class="w-2 h-2 rounded-full bg-red-500"></span> UNSAFE';
    }
  }
  const safetyNote = document.getElementById('safety-concentration-note');
  if (safetyNote) safetyNote.textContent = `${concentration.toFixed(2)} ppm · batas SAFE ≤${SAFE_THRESHOLD_PPM} ppm`;

  // Reaction time badges
  if (reactionTimeMin !== null) {
    const currentRtEl = document.getElementById('current-reaction-time');
    if (currentRtEl) currentRtEl.textContent = `Siklus: ${reactionTimeMin} menit`;

    document.querySelectorAll('.reaction-time-dot').forEach(dot => {
      const min = parseInt(dot.dataset.min);
      if (min === reactionTimeMin) {
        dot.style.opacity = '1';
        dot.style.fontWeight = '800';
      } else {
        dot.style.opacity = '0.4';
        dot.style.fontWeight = '700';
      }
    });
  }

  // Timestamp
  if (latest.timestamp) {
    const time = new Date(latest.timestamp).toLocaleTimeString('id-ID');
    const lastEl = document.getElementById('last-update-time');
    if (lastEl) lastEl.textContent = time;
    const analyticsEl = document.getElementById('analytics-last-update');
    if (analyticsEl) analyticsEl.textContent = time;
  }

  // Status badge
  let statusText = '■ IDLE';
  let statusClass = 'bg-surface-container-highest border border-outline-variant text-on-surface-variant';
  if (degradation >= 90) {
    statusText = '✓ SELESAI';
    statusClass = 'bg-tertiary/10 border border-tertiary text-tertiary';
  } else if (degradation >= 50) {
    statusText = '⟳ BERLANGSUNG';
    statusClass = 'bg-primary/10 border border-primary text-primary';
  } else if (degradation > 0) {
    statusText = '▶ DIMULAI';
    statusClass = 'bg-yellow-500/10 border border-yellow-500/30 text-yellow-400';
  }
  const badge = document.getElementById('status-badge');
  if (badge) {
    badge.textContent = statusText;
    badge.className = `inline-flex items-center gap-xs px-sm py-xs rounded-lg font-label-caps text-label-caps w-fit ${statusClass}`;
  }

  updateAnalyticsSessionSummary({ absorbance, concentration, degradation, isSafe, reactionTimeMin, timestamp: latest.timestamp });

  const specAbs = document.getElementById('spec-absorbance');
  if (specAbs) specAbs.textContent = absorbance.toFixed(3) + ' a.u.';
}

function updateAnalyticsSessionSummary({ absorbance, concentration, degradation, isSafe, reactionTimeMin, timestamp }) {
  const afEl = document.getElementById('analytics-af');
  if (afEl) afEl.textContent = absorbance.toFixed(3);

  const degEl = document.getElementById('analytics-degradation');
  if (degEl) degEl.textContent = degradation.toFixed(1) + '%';

  const barEl = document.getElementById('analytics-degradation-bar');
  if (barEl) barEl.style.width = Math.min(degradation, 100) + '%';

  const concEl = document.getElementById('analytics-concentration');
  if (concEl) concEl.textContent = concentration.toFixed(2) + ' ppm';

  const safeBadge = document.getElementById('analytics-safety-badge');
  if (safeBadge) {
    safeBadge.className = isSafe
      ? 'inline-flex items-center gap-xs px-sm py-xs bg-green-500/10 border border-green-500/30 text-green-400 rounded-lg font-label-caps text-label-caps'
      : 'inline-flex items-center gap-xs px-sm py-xs bg-red-500/10 border border-red-500/30 text-red-400 rounded-lg font-label-caps text-label-caps unsafe-blink';
    safeBadge.innerHTML = isSafe
      ? '<span class="w-2 h-2 rounded-full bg-green-500"></span> SAFE'
      : '<span class="w-2 h-2 rounded-full bg-red-500"></span> UNSAFE';
  }

  const rtEl = document.getElementById('analytics-reaction-time');
  if (rtEl) rtEl.textContent = reactionTimeMin !== null ? `${reactionTimeMin} menit` : '-';
}

// ============================================================================
// SYNC KE measurementHistory[] (dipakai History / Analytics / Log Detail)
// ============================================================================

function syncMeasurementHistoryFromCycles(experimentId, wt, cycles) {
  measurementHistory = measurementHistory.filter(
    m => !(m.experimentId === experimentId && m.wastewaterType === wt)
  );

  const normalized = cycles.map(c => normalizeCycleRecord(c, c && c.id));
  const sorted = [...normalized].sort((a, b) => (a.cycle ?? 0) - (b.cycle ?? 0));
  const first = sorted[0];
  const a0 = first && Number.isFinite(first.absorbanceMax) ? first.absorbanceMax : null;

  sorted.forEach(cycle => {
    const absorbance = Number.isFinite(cycle.absorbanceMax) ? cycle.absorbanceMax : 0;
    const concentration = a0 && a0 !== 0 ? (absorbance / a0) * INITIAL_CONCENTRATION : 0;
    const degradation = a0 && a0 !== 0 ? Math.max(0, ((a0 - absorbance) / a0) * 100) : 0;
    const reactionTimeMin = DASH_TIME_POINTS[cycle.cycle] ?? cycle.elapsedMinutes ?? null;

    measurementHistory.unshift({
      experimentId,
      wastewaterType: wt,
      timestamp: cycle.timestamp || new Date().toISOString(),
      absorbance,
      lambdaMax: cycle.lambdaMax,
      concentration,
      degradation,
      reactionTimeMin,
      session: 1,
      cycle: cycle.cycle
    });
  });

  if (measurementHistory.length > 500) measurementHistory.length = 500;
}

function updateMeasurementStatus(status) {
  const statuses = {
    measuring: '⏸️ MEASURING',
    stopped:   '⏹️ STOPPED',
    idle:      '⏸️ IDLE'
  };
  const el = document.getElementById('measurement-status');
  if (el) el.textContent = statuses[status] || status;
}