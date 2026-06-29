// ============================================================================
// MICROWAT - ESP32 Simulator
// ============================================================================

let simulatorState = {
  ultrasonicDistance: 25.5,
  rainStatus: 'BASAH',
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
      addSimulationLog(`[DISTANCE] Jarak: ${simulatorState.ultrasonicDistance.toFixed(1)} cm`);
    });
  }

  document.getElementById('btn-rain-dry')?.addEventListener('click', () => {
    simulatorState.rainStatus = 'KERING';
    updateRainButtonStates();
    updateSimulatorDisplay();
    addSimulationLog('[RAIN] Sensor hujan: KERING');
  });

  document.getElementById('btn-rain-wet')?.addEventListener('click', () => {
    simulatorState.rainStatus = 'BASAH';
    updateRainButtonStates();
    updateSimulatorDisplay();
    addSimulationLog('[RAIN] Sensor hujan: BASAH');
  });

  document.getElementById('btn-send-data')?.addEventListener('click', sendSimulatorData);
  document.getElementById('btn-auto-simulate')?.addEventListener('click', toggleAutoSimulation);

  updateRainButtonStates();
  addSimulationLog('[INIT] Simulasi ESP32 siap dijalankan');
}

function updateRainButtonStates() {
  const dry = document.getElementById('btn-rain-dry');
  const wet = document.getElementById('btn-rain-wet');
  if (!dry || !wet) return;

  if (simulatorState.rainStatus === 'KERING') {
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

  const ultraStatus = simulatorState.ultrasonicDistance <= 50 ? 'DEKAT' : 'JAUH';
  const statusEl = document.getElementById('ultrasonic-status');
  if (statusEl) statusEl.textContent = ultraStatus;

  const rainText = document.getElementById('rain-text');
  if (rainText) rainText.textContent = simulatorState.rainStatus;

  const rainIcon = document.getElementById('rain-icon');
  if (rainIcon) rainIcon.textContent = simulatorState.rainStatus === 'BASAH' ? '💧' : '☀️';

  updateSimulatorJSON();
}

function updateSimulatorJSON() {
  const ultraStatus = simulatorState.ultrasonicDistance <= 50 ? 'DEKAT' : 'JAUH';
  const data = {
    timestamp: new Date().toLocaleTimeString('id-ID'),
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
    addNotification('[OK] Data simulator dikirim ke server', 'success');
    addSimulationLog(`[SEND] Jarak=${data.ultrasonic_distance}cm, Hujan=${data.rain_sensor}`);
  } else {
    addNotification('[ERROR] WebSocket tidak terhubung', 'warning');
    addSimulationLog('[ERROR] Gagal mengirim data: WebSocket offline');
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
    addSimulationLog('[STOP] Simulasi otomatis dihentikan');
  } else {
    simulatorState.isAutoSimulating = true;
    if (autoBtn) {
      autoBtn.innerHTML = '<span class="material-symbols-outlined text-[18px] animate-pulse">stop_circle</span> Stop Auto';
      autoBtn.className = autoBtn.className.replace('bg-primary-container text-on-primary-container', 'bg-tertiary/10 border border-tertiary text-tertiary');
    }
    addSimulationLog('[START] Simulasi otomatis dimulai');

    simulatorState.autoSimulationInterval = setInterval(() => {
      const change = (Math.random() - 0.5) * 20;
      simulatorState.ultrasonicDistance = Math.max(5, Math.min(200, simulatorState.ultrasonicDistance + change));

      if (Math.random() < 0.1) {
        simulatorState.rainStatus = Math.random() > 0.5 ? 'BASAH' : 'KERING';
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

  const timestamp = new Date().toLocaleTimeString('id-ID');
  const entry = document.createElement('p');
  entry.className = 'font-data-md text-on-surface-variant text-[11px]';
  entry.textContent = `[${timestamp}] ${message}`;
  container.appendChild(entry);
  container.scrollTop = container.scrollHeight;

  const entries = container.querySelectorAll('p');
  if (entries.length > 20) entries[0].remove();
}
