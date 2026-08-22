// ============================================================================
// MICROWAT - Simulator (ESP32 legacy + Spectral Measurement Simulation)
// ============================================================================

// ─── Spectral Simulation ─────────────────────────────────────────────────────

// Menggunakan SPECTRAL_PROFILES, DEGRADATION_DECAY, generateSpectrum dari utils.js
const SIM_TIME_POINTS  = [0, 15, 30, 45, 60];
const SIM_WAVELENGTHS  = [];
for (let w = 200; w <= 800; w += 5) SIM_WAVELENGTHS.push(w); // 121 titik

let spectralSimStep    = 0;   // indeks fase (0-4)
let spectralSimWlIdx   = 0;   // indeks panjang gelombang saat ini (0-120)
let spectralSimWt      = 'rc';
let spectralSimActive  = false;
let spectralSimSession = 1;
let spectralSimTimer   = null;
let spectralSimAbsCache = []; // pre-computed absorbance untuk fase aktif

function precomputePhaseAbs(step) {
  // Hitung semua nilai absorbansi untuk satu fase (sudah termasuk noise halus)
  const timeMin = SIM_TIME_POINTS[step];
  return generateSpectrum(spectralSimWt, timeMin, SIM_WAVELENGTHS);
}

function runSimTick() {
  if (!spectralSimActive) return;

  const w   = SIM_WAVELENGTHS[spectralSimWlIdx];
  const baseAbs = spectralSimAbsCache[spectralSimWlIdx];
  // Noise ±3% per titik (naik/turun sesuai variasi sensor nyata)
  const absorbance = Math.max(0, baseAbs * (1 + (Math.random() - 0.5) * 0.06));
  const timeMin    = SIM_TIME_POINTS[spectralSimStep];

  // Plot ke grafik — satu titik (wavelength, absorbance)
  if (typeof addSpectralPointToChart === 'function') {
    addSpectralPointToChart(w, absorbance, timeMin);
  }

  // Log setiap 10 titik supaya tidak spam
  if (spectralSimWlIdx % 10 === 0) {
    const initAbs = (SPECTRAL_PROFILES[spectralSimWt] || SPECTRAL_PROFILES.mb).initialAbs;
    const decay   = DEGRADATION_DECAY[spectralSimStep];
    const deg     = ((1 - decay) * 100).toFixed(0);
    addSimLog(`[SIM] t=${timeMin}min λ=${w}nm | A=${absorbance.toFixed(4)} | D=${deg}%`);
  }

  // Saat semua panjang gelombang fase ini selesai → update history & display
  if (spectralSimWlIdx === SIM_WAVELENGTHS.length - 1) {
    const peakAbs = spectralSimAbsCache.reduce((mx, v) => v > mx ? v : mx, 0);
    const initAbs = (SPECTRAL_PROFILES[spectralSimWt] || SPECTRAL_PROFILES.mb).initialAbs;
    const conc    = (peakAbs / initAbs) * 10;
    const deg     = ((1 - peakAbs / initAbs) * 100);
    const spectralData = SIM_WAVELENGTHS.map((wl, i) => ({ wavelength: wl, absorbance: spectralSimAbsCache[i] }));
    const measurement  = {
      timestamp: new Date().toISOString(),
      absorbance: peakAbs,
      spectralData,
      wastewaterType: spectralSimWt,
      reactionTimeMin: timeMin,
      concentration: conc,
      degradation: deg,
      session: spectralSimSession
    };
    if (typeof updateMeasurementDisplay === 'function') updateMeasurementDisplay(measurement);
    if (typeof addMeasurementToHistory === 'function') addMeasurementToHistory(measurement);
    addSimLog(`[DONE] t=${timeMin}min complete | A_peak=${peakAbs.toFixed(3)} | C=${conc.toFixed(2)}ppm | D=${deg.toFixed(1)}%`);
    updateSimProgress(spectralSimStep);

    // Continue to next phase
    spectralSimStep++;
    spectralSimWlIdx = 0;
    if (spectralSimStep >= SIM_TIME_POINTS.length) {
      stopSpectralSim(true);
      return;
    }
    spectralSimAbsCache = precomputePhaseAbs(spectralSimStep);
  } else {
    spectralSimWlIdx++;
  }

  // Schedule next point
  spectralSimTimer = setTimeout(runSimTick, spectralSimIntervalMs);
}

let spectralSimIntervalMs = 1000;

function startSpectralSim() {
  if (spectralSimActive) return;

  spectralSimIntervalMs = Math.max(50, parseInt(document.getElementById('sim-interval')?.value || '1', 10) * 1000);
  const wt = document.querySelector('.sim-wt-btn.sim-wt-active')?.dataset?.wt || 'rc';
  spectralSimWt      = wt;
  spectralSimStep    = 0;
  spectralSimWlIdx   = 0;
  spectralSimActive  = true;
  spectralSimAbsCache = precomputePhaseAbs(0);

  const today = new Date().toISOString().split('T')[0];
  const todaySessions = new Set(
    (window.measurementHistory || []).filter(m => m.timestamp?.startsWith(today)).map(m => m.session || 1)
  );
  spectralSimSession = todaySessions.size + 1;

  window.simMode = true;
  document.querySelectorAll('#sim-mode-banner').forEach(el => el.classList.remove('hidden'));
  setSimButtons(true);
  addSimLog(`[START] Simulation started — Session ${spectralSimSession} | ${spectralSimIntervalMs}ms/pt | ${SIM_WAVELENGTHS.length} λ/phase`);
  addNotification('🧪 Simulation Mode active', 'info');

  spectralSimTimer = setTimeout(runSimTick, 0);
}

function stopSpectralSim(completed = false) {
  spectralSimActive = false;
  if (spectralSimTimer) { clearTimeout(spectralSimTimer); spectralSimTimer = null; }
  window.simMode = false;
  document.querySelectorAll('#sim-mode-banner').forEach(el => el.classList.add('hidden'));
  setSimButtons(false);
  addSimLog(completed ? '[DONE] Simulation complete — 5/5 cycles.' : '[STOP] Simulation stopped.');
  if (completed) addNotification('✅ Simulation complete — 5 cycles finished', 'success');
  updateSimProgress(-1);
}

function resetSimData() {
  stopSpectralSim();
  if (typeof measurementHistory !== 'undefined') {
    measurementHistory.length = 0;
  }
  if (typeof initDashboardChart === 'function') initDashboardChart();
  if (typeof resetAnalyticsChart === 'function') resetAnalyticsChart();
  spectralSimStep  = 0;
  spectralSimWlIdx = 0;
  // Reset KPI displays
  ['degradation-value','concentration-value','last-update-time','analytics-degradation','analytics-concentration'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = '-';
  });
  const badge = document.getElementById('safety-status-badge');
  if (badge) { badge.className = 'mt-xs inline-flex items-center gap-xs px-sm py-xs bg-surface-container-highest border border-outline text-on-surface-variant rounded-lg font-label-caps text-label-caps w-fit'; badge.innerHTML = '-'; }
  updateSimProgress(-1);
  addSimLog('[RESET] Simulation data cleared.');
  addNotification('🔄 Simulation data reset', 'warning');
}

function setSimButtons(running) {
  const btnStart = document.getElementById('btn-sim-start');
  const btnStop  = document.getElementById('btn-sim-stop');
  if (btnStart) btnStart.disabled = running;
  if (btnStop)  btnStop.disabled  = !running;
  if (btnStart) btnStart.classList.toggle('opacity-40', running);
  if (btnStop)  btnStop.classList.toggle('opacity-40', !running);
}

function updateSimProgress(activeStep) {
  document.querySelectorAll('.sim-step-dot').forEach((dot, i) => {
    dot.classList.remove('bg-primary', 'bg-tertiary', 'bg-surface-container-highest', 'ring-2', 'ring-primary');
    if (i < activeStep) {
      dot.classList.add('bg-tertiary'); // completed
    } else if (i === activeStep) {
      dot.classList.add('bg-primary', 'ring-2', 'ring-primary'); // active
    } else {
      dot.classList.add('bg-surface-container-highest'); // pending
    }
  });
}

function addSimLog(msg) {
  const log = document.getElementById('sim-log');
  if (!log) return;
  const time = new Date().toLocaleTimeString('en-US');
  const p = document.createElement('p');
  p.className = 'text-[11px] font-data-md text-on-surface-variant leading-snug';
  p.textContent = `[${time}] ${msg}`;
  log.insertBefore(p, log.firstChild);
  while (log.children.length > 12) log.removeChild(log.lastChild);
}

function initSpectralSimPanel() {
  // Waste type buttons
  document.querySelectorAll('.sim-wt-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.sim-wt-btn').forEach(b => {
        b.classList.remove('sim-wt-active', 'bg-secondary/20', 'border-secondary', 'text-secondary');
        b.classList.add('border-outline-variant', 'text-on-surface-variant');
      });
      btn.classList.add('sim-wt-active', 'bg-secondary/20', 'border-secondary', 'text-secondary');
      btn.classList.remove('border-outline-variant', 'text-on-surface-variant');
    });
  });
  // Set default active
  const first = document.querySelector('.sim-wt-btn');
  if (first) first.classList.add('sim-wt-active', 'bg-secondary/20', 'border-secondary', 'text-secondary');

  document.getElementById('btn-sim-start')?.addEventListener('click', startSpectralSim);
  document.getElementById('btn-sim-stop')?.addEventListener('click', () => stopSpectralSim(false));
  document.getElementById('btn-sim-reset')?.addEventListener('click', resetSimData);

  setSimButtons(false);
  updateSimProgress(-1);
  addSimLog('[INIT] Simulation panel ready.');
}
// ─────────────────────────────────────────────────────────────────────────────

let simulatorState = {
  ultrasonicDistance: 25.5,
  rainStatus: 'WET',
  isAutoSimulating: false,
  autoSimulationInterval: null
};

function initSimulatorSection() {
  console.log('🔧 Init Simulator');

  updateSimulatorDisplay();

  const slider = document.getElementById('ultrasonic-slider');
  if (slider) {
    slider.value = simulatorState.ultrasonicDistance;
    slider.addEventListener('input', e => {
      simulatorState.ultrasonicDistance = parseFloat(e.target.value);
      updateSimulatorDisplay();
      addSimulationLog(`[DISTANCE] Distance: ${simulatorState.ultrasonicDistance.toFixed(1)} cm`);
    });
  }

  document.getElementById('btn-rain-dry')?.addEventListener('click', () => {
    simulatorState.rainStatus = 'DRY';
    updateRainButtonStates();
    updateSimulatorDisplay();
    addSimulationLog('[RAIN] Rain sensor: DRY');
  });

  document.getElementById('btn-rain-wet')?.addEventListener('click', () => {
    simulatorState.rainStatus = 'WET';
    updateRainButtonStates();
    updateSimulatorDisplay();
    addSimulationLog('[RAIN] Rain sensor: WET');
  });

  document.getElementById('btn-send-data')?.addEventListener('click', sendSimulatorData);
  document.getElementById('btn-auto-simulate')?.addEventListener('click', toggleAutoSimulation);

  updateRainButtonStates();
  addSimulationLog('[INIT] ESP32 simulation ready to run');
}

function updateRainButtonStates() {
  const dry = document.getElementById('btn-rain-dry');
  const wet = document.getElementById('btn-rain-wet');
  if (!dry || !wet) return;

  if (simulatorState.rainStatus === 'DRY') {
    dry.className = dry.className.replace('bg-primary/20 border-primary/50 text-primary', 'bg-yellow-500/20 border-yellow-500/50 text-yellow-400');
    dry.classList.add('bg-yellow-500/20', 'border-yellow-500/50', 'text-yellow-400');
    dry.classList.remove('bg-primary/20', 'border-primary/50', 'text-primary');
    wet.classList.remove('bg-primary/20', 'border-primary/50', 'text-primary');
    wet.classList.add('bg-surface-container-highest/50', 'border-outline-variant', 'text-on-surface-variant');
  } else {
    wet.classList.add('bg-primary/20', 'border-primary/50', 'text-primary');
    wet.classList.remove('bg-surface-container-highest/50', 'border-outline-variant', 'text-on-surface-variant');
    dry.classList.remove('bg-yellow-500/20', 'border-yellow-500/50', 'text-yellow-400');
    dry.classList.add('bg-surface-container-highest/50', 'border-outline-variant', 'text-on-surface-variant');
  }
}

function updateSimulatorDisplay() {
  const val = document.getElementById('ultrasonic-value');
  if (val) val.textContent = simulatorState.ultrasonicDistance.toFixed(1);

  const ultraStatus = simulatorState.ultrasonicDistance <= 50 ? 'NEAR' : 'FAR';
  const statusEl = document.getElementById('ultrasonic-status');
  if (statusEl) statusEl.textContent = ultraStatus;

  const rainText = document.getElementById('rain-text');
  if (rainText) rainText.textContent = simulatorState.rainStatus;

  const rainIcon = document.getElementById('rain-icon');
  if (rainIcon) rainIcon.textContent = simulatorState.rainStatus === 'WET' ? '💧' : '☀️';

  updateSimulatorJSON();
}

function updateSimulatorJSON() {
  const ultraStatus = simulatorState.ultrasonicDistance <= 50 ? 'NEAR' : 'FAR';
  const data = {
    timestamp: new Date().toLocaleTimeString('en-US'),
    ultrasonic_distance: parseFloat(simulatorState.ultrasonicDistance.toFixed(1)),
    ultrasonic_status: ultraStatus,
    rain_sensor: simulatorState.rainStatus,
    esp_status: 'ONLINE',
    wifi_ssid: 'UBINNMASJIDD'
  };

  const jsonEl = document.getElementById('simulator-json');
  if (jsonEl) jsonEl.textContent = JSON.stringify(data, null, 2);

  return data;
}

function sendSimulatorData() {
  const data = updateSimulatorJSON();
  if (socket?.connected) {
    socket.emit('simulatorData', data);
    addNotification('[OK] Simulator data sent to server', 'success');
    addSimulationLog(`[SEND] Distance=${data.ultrasonic_distance}cm, Rain=${data.rain_sensor}`);
  } else {
    addNotification('[ERROR] WebSocket not connected', 'warning');
    addSimulationLog('[ERROR] Failed to send data: WebSocket offline');
  }
}

function toggleAutoSimulation() {
  const autoBtn = document.getElementById('btn-auto-simulate');

  if (simulatorState.isAutoSimulating) {
    simulatorState.isAutoSimulating = false;
    clearInterval(simulatorState.autoSimulationInterval);
    if (autoBtn) {
      autoBtn.innerHTML = '<span class="material-symbols-outlined text-[18px]">play_circle</span> Auto Simulate';
      autoBtn.className = autoBtn.className.replace('bg-tertiary/10 border-tertiary text-tertiary', 'bg-primary-container text-on-primary-container');
    }
    addSimulationLog('[STOP] Auto simulation stopped');
  } else {
    simulatorState.isAutoSimulating = true;
    if (autoBtn) {
      autoBtn.innerHTML = '<span class="material-symbols-outlined text-[18px] animate-pulse">stop_circle</span> Stop Auto';
      autoBtn.className = autoBtn.className.replace('bg-primary-container text-on-primary-container', 'bg-tertiary/10 border border-tertiary text-tertiary');
    }
    addSimulationLog('[START] Auto simulation started');

    simulatorState.autoSimulationInterval = setInterval(() => {
      const change = (Math.random() - 0.5) * 20;
      simulatorState.ultrasonicDistance = Math.max(5, Math.min(200, simulatorState.ultrasonicDistance + change));

      if (Math.random() < 0.1) {
        simulatorState.rainStatus = Math.random() > 0.5 ? 'WET' : 'DRY';
        updateRainButtonStates();
      }

      updateSimulatorDisplay();
      sendSimulatorData();
    }, 1000);
  }
}

function addSimulationLog(message) {
  const container = document.getElementById('simulation-log');
  if (!container) return;

  const timestamp = new Date().toLocaleTimeString('en-US');
  const entry = document.createElement('p');
  entry.className = 'font-data-md text-on-surface-variant text-[11px]';
  entry.textContent = `[${timestamp}] ${message}`;
  container.appendChild(entry);
  container.scrollTop = container.scrollHeight;

  const entries = container.querySelectorAll('p');
  if (entries.length > 20) entries[0].remove();
}
