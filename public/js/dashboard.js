// ============================================================================
// MICROWAT - Dashboard Page
// ============================================================================

const CYCLE_COLORS = {
  0:  '#515151',  // 0 min  - hitam (dari docx image kode warna)
  15: '#B177DE',  // 15 min - ungu
  30: '#CC9900',  // 30 min - kuning
  45: '#00CBCC',  // 45 min - tosca
  60: '#7D4E4E'   // 60 min - coklat
};

const INITIAL_CONCENTRATION = 10; // C₀ in ppm (default)

let currentWastewaterType = 'rc';
let baseAbsorbance = null; // A₀ (absorbance at 0 min)

const DASH_TIME_POINTS = [0, 15, 30, 45, 60];
let currentDashPhase = 0;

// Dipanggil simulator tiap interval: menambah SATU titik spektral ke grafik
function addSpectralPointToChart(wavelength, absorbance, reactionTimeMin) {
  addSpectralPointToDashChart(wavelength, absorbance, reactionTimeMin);
  if (typeof addSpectralPointToMonitoringChart === 'function') {
    addSpectralPointToMonitoringChart(wavelength, absorbance, reactionTimeMin);
  }
}

function addSpectralPointToDashChart(wavelength, absorbance, reactionTimeMin) {
  if (!dashboardChartInstance) return;
  const tp    = reactionTimeMin ?? 0;
  const dsIdx = DASH_TIME_POINTS.indexOf(tp);
  if (dsIdx < 0) return;

  dashboardChartInstance.data.datasets[dsIdx].data.push({ x: wavelength, y: absorbance });
  dashboardChartInstance.update('none');

  if (dsIdx > currentDashPhase) {
    currentDashPhase = dsIdx;
    updateDashPhaseUI();
  }
}

function updateDashPhaseUI() {
  const tp = DASH_TIME_POINTS[currentDashPhase];
  const phaseText = document.getElementById('dash-phase-text');
  if (phaseText) phaseText.textContent = `Fase ${currentDashPhase + 1}/5 · ${tp} menit`;

  const dotsContainer = document.getElementById('dash-phase-dots');
  if (dotsContainer) {
    const dots = dotsContainer.querySelectorAll('span');
    DASH_TIME_POINTS.forEach((t, i) => {
      if (dots[i]) dots[i].style.opacity = i <= currentDashPhase ? '1' : '0.2';
    });
  }
}

function initDashboardPage() {
  console.log('🔧 Init Dashboard');

  // Sync simulation banner
  const banner = document.getElementById('sim-mode-banner');
  if (banner) banner.classList.toggle('hidden', !window.simMode);

  // Wastewater type buttons
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
    });
  });

  // Init dashboard chart
  initDashboardChart();

  // Render with current data
  if (measurementHistory.length > 0) {
    updateMeasurementDisplay(measurementHistory[0]);
  }
}

function hexToRgb(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `${r},${g},${b}`;
}

function initDashboardChart() {
  const ctx = document.getElementById('dashboard-chart');
  if (!ctx) return;

  currentDashPhase = 0;

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
    tension: 0.3,
    fill: false,
    spanGaps: false
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
          min: 200,
          max: 800,
          ticks: { color: '#4a6070', font: { family: 'Poppins', size: 10 }, stepSize: 50 },
          grid: { color: 'rgba(74, 96, 112, 0.2)' },
          title: { display: true, text: 'Panjang Gelombang (nm)', color: '#a0b4c4', font: { size: 11, family: 'Poppins' } }
        },
        y: {
          min: -0.05,
          max: 1.0,
          ticks: { color: '#7dd3fc', font: { family: 'Poppins', size: 10 } },
          grid: { color: 'rgba(74, 96, 112, 0.2)' },
          title: { display: true, text: 'Absorbansi (a.u.)', color: '#7dd3fc', font: { size: 11, family: 'Poppins' } }
        }
      }
    }
  });

  updateDashPhaseUI();
}

function updateMeasurementDisplay(measurement) {
  if (!measurement) return;

  const absorbance = measurement.absorbance || 0;

  // Set base absorbance (A₀) from measurement at 0 min or first reading
  if (!baseAbsorbance || measurement.reactionTimeMin === 0) {
    if (absorbance > 0) baseAbsorbance = absorbance;
  }

  // Calculate concentration: C = (A / A₀) × C₀
  const concentration = baseAbsorbance && baseAbsorbance > 0
    ? (absorbance / baseAbsorbance) * INITIAL_CONCENTRATION
    : 0;

  // Calculate degradation: ((C₀ - C) / C₀) × 100
  const degradation = baseAbsorbance && baseAbsorbance > 0
    ? Math.max(0, ((baseAbsorbance - absorbance) / baseAbsorbance) * 100)
    : (measurement.degradation || 0);

  // Safety status: SAFE jika konsentrasi ≤ 5 ppm (sesuai docx)
  const isSafe = concentration <= 5;

  // Reaction time
  const reactionTimeMin = measurement.reactionTimeMin !== undefined ? measurement.reactionTimeMin : null;

  // ── Update DOM elements ──

  const concEl = document.getElementById('concentration-value');
  if (concEl) concEl.textContent = concentration.toFixed(2);

  const degEl = document.getElementById('degradation-value');
  if (degEl) degEl.textContent = degradation.toFixed(1) + '%';

  // Progress circle (SVG)
  const circle = document.getElementById('degradation-circle');
  if (circle) {
    const circumference = 2 * Math.PI * 24;
    const offset = circumference - (Math.min(degradation, 100) / 100) * circumference;
    circle.style.strokeDashoffset = offset;
  }

  // Safety Status badge
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
  if (safetyNote) safetyNote.textContent = `${concentration.toFixed(2)} ppm · batas SAFE ≤5 ppm`;

  // Reaction time highlight
  if (reactionTimeMin !== null) {
    const currentRtEl = document.getElementById('current-reaction-time');
    if (currentRtEl) {
      currentRtEl.textContent = `Siklus: ${reactionTimeMin} menit`;
    }

    // Highlight current cycle badge
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
  if (measurement.timestamp) {
    const time = new Date(measurement.timestamp).toLocaleTimeString('id-ID');
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

  // Analytics Session Summary
  updateAnalyticsSessionSummary({ absorbance, concentration, degradation, isSafe, reactionTimeMin, timestamp: measurement.timestamp });

  // Device status page — update spectrometer absorbance display
  const specAbs = document.getElementById('spec-absorbance');
  if (specAbs) specAbs.textContent = absorbance.toFixed(3) + ' a.u.';

  updateSystemStatus('hardware', 'online');
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

function addMeasurementToHistory(measurement) {
  // Ensure session and reaction time are populated
  if (measurement.reactionTimeMin === undefined) {
    measurement.reactionTimeMin = inferReactionTime(measurement.timestamp);
  }
  if (!measurement.session) {
    measurement.session = inferSession(measurement.timestamp);
  }

  measurementHistory.unshift(measurement);
  if (measurementHistory.length > 500) measurementHistory.pop();
}

function inferReactionTime(timestamp) {
  // Group measurements into 15-min slots relative to session start
  const today = measurementHistory.filter(m => {
    return new Date(m.timestamp).toDateString() === new Date(timestamp).toDateString();
  });
  const idx = today.length;
  return (idx % 5) * 15; // 0, 15, 30, 45, 60, 0, 15, ...
}

function inferSession(timestamp) {
  // Count how many complete 5-measurement cycles happened today
  const today = measurementHistory.filter(m => {
    return new Date(m.timestamp).toDateString() === new Date(timestamp).toDateString();
  });
  return Math.floor(today.length / 5) + 1;
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
