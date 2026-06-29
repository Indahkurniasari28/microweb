// ============================================================================
// MICROWAT - Complete Simulator Application
// ============================================================================

let currentUser = null;
let socket = null;
let measurementHistory = [];
let chartInstance = null;
let degradationChartInstance = null;
let systemParameters = {};

// Initialize
window.addEventListener('DOMContentLoaded', initializeApp);

/**
 * Main initialization
 */
function initializeApp() {
  console.log('🚀 MICROWAT Simulator Initialization...');

  initializeSocket();
  setupAuthFormListeners();
  setupPageNavigation();
  setupControlButtons();
  checkAuthState();
  registerServiceWorker();

  console.log('✅ MICROWAT Ready');
}

// ============================================================================
// SOCKET.IO
// ============================================================================

// Safe localStorage helpers
const safeStorage = {
  getItem: (key) => {
    try {
      return localStorage.getItem(key);
    } catch (e) {
      console.warn('localStorage access blocked:', e);
      return null;
    }
  },
  setItem: (key, value) => {
    try {
      localStorage.setItem(key, value);
      return true;
    } catch (e) {
      console.warn('localStorage write blocked:', e);
      return false;
    }
  },
  removeItem: (key) => {
    try {
      localStorage.removeItem(key);
      return true;
    } catch (e) {
      console.warn('localStorage remove blocked:', e);
      return false;
    }
  }
};

function initializeSocket() {
  if (typeof io === 'undefined') {
    console.error('❌ Socket.io not loaded');
    return;
  }

  socket = io();

  socket.on('connect', () => {
    console.log('✅ WebSocket connected');
    updateSystemStatus('mqtt', 'online');
    addNotification('✅ Terhubung ke server', 'success');
  });

  socket.on('disconnect', () => {
    console.log('❌ WebSocket disconnected');
    updateSystemStatus('mqtt', 'offline');
    addNotification('❌ Terputus dari server', 'error');
  });

  socket.on('spectrometerUpdate', data => {
    console.log('📊 Measurement received:', data);
    updateMeasurementDisplay(data);
    addMeasurementToHistory(data);
    updateCharts();
    addNotification('📊 Data pengukuran diperbarui', 'info');
  });

  socket.on('esp32Data', data => {
    console.log('[ESP32] Data received:', data);
    updateEsp32Display(data);
  });

  socket.on('measurementStarted', () => {
    addNotification('▶️  Pengukuran dimulai', 'info');
    updateMeasurementStatus('measuring');
  });

  socket.on('measurementStopped', () => {
    addNotification('⏹️  Pengukuran dihentikan', 'warning');
    updateMeasurementStatus('stopped');
  });

  socket.on('measurementReset', () => {
    addNotification('🔄 Data pengukuran direset', 'warning');
    updateMeasurementStatus('idle');
  });
}

// ============================================================================
// AUTHENTICATION
// ============================================================================

function setupAuthFormListeners() {
  // Toggle forms
  document.getElementById('register-link')?.addEventListener('click', e => {
    e.preventDefault();
    toggleAuthSection('register-section');
  });

  document.getElementById('login-link')?.addEventListener('click', e => {
    e.preventDefault();
    toggleAuthSection('login-section');
  });

  document.getElementById('forgot-password-link')?.addEventListener('click', e => {
    e.preventDefault();
    toggleAuthSection('reset-section');
  });

  document.getElementById('back-to-login')?.addEventListener('click', e => {
    e.preventDefault();
    toggleAuthSection('login-section');
  });

  // Login
  document.getElementById('login-form')?.addEventListener('submit', async e => {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;

    try {
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      const data = await response.json();
      if (data.success) {
        safeStorage.setItem('user', JSON.stringify(data.user));
        currentUser = data.user;
        clearAuthForms();
        showMainApp();
        await loadSystemParameters();
        addNotification(`✅ Selamat datang, ${email}!`, 'success');
      } else {
        showAuthError('login', data.message);
      }
    } catch (error) {
      showAuthError('login', error.message);
    }
  });

  // Register
  document.getElementById('register-form')?.addEventListener('submit', async e => {
    e.preventDefault();
    const email = document.getElementById('register-email').value;
    const password = document.getElementById('register-password').value;
    const confirm = document.getElementById('register-confirm').value;

    if (password !== confirm) {
      showAuthError('register', 'Kata sandi tidak cocok');
      return;
    }

    if (password.length < 6) {
      showAuthError('register', 'Kata sandi minimal 6 karakter');
      return;
    }

    try {
      const response = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      const data = await response.json();
      if (data.success) {
        alert('✅ Akun berhasil dibuat! Silakan login.');
        toggleAuthSection('login-section');
        clearAuthForms();
      } else {
        showAuthError('register', data.message);
      }
    } catch (error) {
      showAuthError('register', error.message);
    }
  });

  // Reset Password
  document.getElementById('reset-form')?.addEventListener('submit', async e => {
    e.preventDefault();
    const email = document.getElementById('reset-email').value;

    try {
      const response = await fetch('/api/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });

      const data = await response.json();
      if (data.success) {
        alert('✅ Email reset telah dikirim');
        toggleAuthSection('login-section');
      } else {
        showAuthError('reset', data.message);
      }
    } catch (error) {
      showAuthError('reset', error.message);
    }
  });

  // Logout
  document.getElementById('logout-btn')?.addEventListener('click', logout);
  document.getElementById('btn-logout-settings')?.addEventListener('click', logout);
}

function toggleAuthSection(sectionId) {
  document.querySelectorAll('.auth-section').forEach(s => s.classList.add('hidden'));
  const section = document.getElementById(sectionId);
  if (section) section.classList.remove('hidden');
}

function showAuthError(section, message) {
  const el = document.getElementById(`${section}-error`);
  if (el) {
    el.textContent = '❌ ' + message;
    el.classList.remove('hidden');
  }
}

function clearAuthForms() {
  document.querySelectorAll('input[type="email"], input[type="password"]').forEach(input => input.value = '');
  document.querySelectorAll('.error-message').forEach(error => error.classList.add('hidden'));
}

function checkAuthState() {
  const user = safeStorage.getItem('user');
  if (user) {
    try {
      currentUser = JSON.parse(user);
      updateUserDisplay(currentUser.email);
      showMainApp();
      loadSystemParameters();
    } catch (error) {
      logout();
    }
  } else {
    showAuthContainer();
  }
}

function logout() {
  safeStorage.removeItem('user');
  currentUser = null;
  measurementHistory = [];
  showAuthContainer();
  clearAuthForms();
  addNotification('✅ Anda telah logout', 'info');
}

function showAuthContainer() {
  document.getElementById('auth-container').classList.remove('hidden');
  document.getElementById('main-app').classList.add('hidden');
  toggleAuthSection('login-section');
}

function showMainApp() {
  document.getElementById('auth-container').classList.add('hidden');
  document.getElementById('main-app').classList.remove('hidden');
}

function updateUserDisplay(email) {
  const els = [document.getElementById('user-email-display'), document.getElementById('settings-email')];
  els.forEach(el => {
    if (el) el.textContent = email;
  });
}

// ============================================================================
// PAGE NAVIGATION
// ============================================================================

function setupPageNavigation() {
  document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', e => {
      e.preventDefault();
      const page = link.dataset.page;
      navigateToPage(page);
    });
  });
}

function navigateToPage(pageName) {
  console.log('🔄 Navigating to page:', pageName);
  
  // Update nav
  document.querySelectorAll('.nav-link').forEach(link => {
    link.classList.toggle('active', link.dataset.page === pageName);
  });

  // Update pages
  document.querySelectorAll('.page').forEach(page => page.classList.add('hidden'));
  const page = document.getElementById(`${pageName}-page`);
  console.log(`Looking for element: ${pageName}-page`, page);
  
  if (page) page.classList.remove('hidden');

  // Update title
  const titles = {
    dashboard: '📊 Dashboard Monitoring',
    monitoring: '📈 Monitoring Real-Time',
    history: '📋 Riwayat Data',
    controls: '⚙️ Kontrol Sistem',
    simulator: '📡 Simulasi ESP32 IoT',
    'esp32-real': '📡 Sensor Real ESP32',
    parameters: '🔧 Parameter Sistem',
    notifications: '🔔 Notifikasi',
    settings: '⚙️ Pengaturan'
  };
  const titleEl = document.getElementById('page-title');
  if (titleEl) titleEl.textContent = titles[pageName] || 'MICROWAT';

  // Initialize page-specific content
  if (pageName === 'monitoring') {
    console.log('Initializing monitoring chart');
    initializeMonitoringChart();
  } else if (pageName === 'history') {
    console.log('Loading history table');
    loadHistoryTable();
  } else if (pageName === 'simulator') {
    console.log('Initializing simulator');
    initializeSimulator();
  } else if (pageName === 'esp32-real') {
    console.log('Initializing ESP32 real sensor');
    initializeEsp32RealSensor();
  }
}

// ============================================================================
// MEASUREMENT DISPLAY
// ============================================================================

function updateMeasurementDisplay(measurement) {
  if (!measurement) return;

  document.getElementById('absorbance-value').textContent = (measurement.absorbance || 0).toFixed(3);
  document.getElementById('concentration-value').textContent = (measurement.concentration || 0).toFixed(2);
  document.getElementById('degradation-value').textContent = (measurement.degradation || 0).toFixed(1) + '%';

  const progress = document.getElementById('degradation-progress');
  if (progress) progress.style.width = (measurement.degradation || 0) + '%';

  if (measurement.timestamp) {
    const time = new Date(measurement.timestamp).toLocaleTimeString('id-ID');
    const el = document.getElementById('measure-timestamp');
    if (el) el.textContent = time;
    
    const lastEl = document.getElementById('last-update-time');
    if (lastEl) lastEl.textContent = time;
  }

  // Update status badge
  let statusText = '■ IDLE';
  let statusColor = '#999';
  if (measurement.degradation >= 90) {
    statusText = '✓ SELESAI';
    statusColor = '#4CAF50';
  } else if (measurement.degradation >= 50) {
    statusText = '⟳ BERLANGSUNG';
    statusColor = '#2196F3';
  } else if (measurement.degradation > 0) {
    statusText = '▶ DIMULAI';
    statusColor = '#FF9800';
  }
  
  const badge = document.getElementById('status-badge');
  if (badge) {
    badge.textContent = statusText;
    badge.style.backgroundColor = statusColor;
  }

  updateSystemStatus('hardware', 'online');
}

function addMeasurementToHistory(measurement) {
  measurementHistory.unshift(measurement);
  if (measurementHistory.length > 500) measurementHistory.pop();
}

function updateSystemStatus(type, status) {
  const statusMap = {
    hardware: 'hardware-status',
    mqtt: 'mqtt-status'
  };

  const elementId = statusMap[type];
  const element = document.getElementById(elementId);
  
  if (element) {
    const isOnline = status === 'online';
    element.textContent = isOnline ? '🟢 Online' : '🔴 Offline';
    element.classList.toggle('online', isOnline);
    element.classList.toggle('offline', !isOnline);
  }

  if (type === 'hardware') {
    const dot = document.getElementById('system-status');
    const text = document.getElementById('system-status-text');
    if (dot && text) {
      dot.classList.toggle('status-online', status === 'online');
      dot.classList.toggle('status-offline', status !== 'online');
      text.textContent = status === 'online' ? 'Online' : 'Offline';
    }
  }
}

function updateMeasurementStatus(status) {
  const statusEl = document.getElementById('measurement-status');
  if (!statusEl) return;

  const statuses = {
    measuring: '⏸️  MEASURING',
    stopped: '⏹️  STOPPED',
    idle: '⏸️  IDLE'
  };

  statusEl.textContent = statuses[status] || status;
}

// ============================================================================
// CHARTS
// ============================================================================

function initializeMonitoringChart() {
  const ctx = document.getElementById('monitoring-chart');
  if (!ctx || chartInstance) return;

  const data = {
    labels: measurementHistory.slice(-20).map((_, i) => `${i + 1}`),
    datasets: [
      {
        label: 'Konsentrasi (ppm)',
        data: measurementHistory.slice(-20).map(m => m.concentration),
        borderColor: '#FF6384',
        backgroundColor: 'rgba(255, 99, 132, 0.1)',
        yAxisID: 'y',
        tension: 0.3
      },
      {
        label: 'Degradasi (%)',
        data: measurementHistory.slice(-20).map(m => m.degradation),
        borderColor: '#36A2EB',
        backgroundColor: 'rgba(54, 162, 235, 0.1)',
        yAxisID: 'y1',
        tension: 0.3
      }
    ]
  };

  chartInstance = new Chart(ctx, {
    type: 'line',
    data: data,
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { position: 'top' }
      },
      scales: {
        y: {
          type: 'linear',
          display: true,
          position: 'left',
          title: { display: true, text: 'Konsentrasi (ppm)' }
        },
        y1: {
          type: 'linear',
          display: true,
          position: 'right',
          title: { display: true, text: 'Degradasi (%)' }
        }
      }
    }
  });
}

function updateCharts() {
  if (!chartInstance) return;

  chartInstance.data.labels = measurementHistory.slice(-20).map((_, i) => `${i + 1}`);
  chartInstance.data.datasets[0].data = measurementHistory.slice(-20).map(m => m.concentration);
  chartInstance.data.datasets[1].data = measurementHistory.slice(-20).map(m => m.degradation);
  chartInstance.update();
}

// ============================================================================
// HISTORY & DATA
// ============================================================================

async function loadHistoryTable() {
  const tbody = document.getElementById('history-table-body');
  if (!tbody) return;

  const fromDate = document.getElementById('history-date-from')?.value || '';
  const toDate = document.getElementById('history-date-to')?.value || '';

  let filtered = measurementHistory;
  
  if (fromDate || toDate) {
    filtered = measurementHistory.filter(m => {
      const date = new Date(m.timestamp).toISOString().split('T')[0];
      if (fromDate && date < fromDate) return false;
      if (toDate && date > toDate) return false;
      return true;
    });
  }

  tbody.innerHTML = '';
  if (filtered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="empty-state">Tidak ada data</td></tr>';
    return;
  }

  tbody.innerHTML = filtered.slice(0, 100).map(m => `
    <tr>
      <td>${new Date(m.timestamp).toLocaleString('id-ID')}</td>
      <td>${(m.absorbance || 0).toFixed(3)}</td>
      <td>${(m.concentration || 0).toFixed(2)}</td>
      <td>${(m.degradation || 0).toFixed(1)}%</td>
      <td>${m.status || 'Auto'}</td>
    </tr>
  `).join('');
}

function exportHistoryCSV() {
  if (measurementHistory.length === 0) {
    alert('Tidak ada data untuk diekspor');
    return;
  }

  let csv = 'Waktu,Absorbansi,Konsentrasi (ppm),Degradasi (%),Status\n';
  measurementHistory.forEach(m => {
    csv += `"${m.timestamp}",${m.absorbance || 0},${m.concentration || 0},${m.degradation || 0},"${m.status || 'Auto'}"\n`;
  });

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `microwat-${new Date().toISOString().split('T')[0]}.csv`;
  link.click();
  addNotification('✅ Data diekspor', 'success');
}

// ============================================================================
// CONTROLS
// ============================================================================

function setupControlButtons() {
  // Button IDs untuk start/stop/reset
  const startBtns = ['btn-start-measurement', 'btn-control-start'];
  const stopBtns = ['btn-stop-measurement', 'btn-control-stop'];
  const resetBtns = ['btn-reset-data', 'btn-control-reset'];

  startBtns.forEach(id => {
    document.getElementById(id)?.addEventListener('click', () => {
      if (socket?.connected) {
        socket.emit('startMeasurement');
      } else {
        addNotification('⚠️  WebSocket tidak terhubung', 'warning');
      }
    });
  });

  stopBtns.forEach(id => {
    document.getElementById(id)?.addEventListener('click', () => {
      if (socket?.connected) {
        socket.emit('stopMeasurement');
      } else {
        addNotification('⚠️  WebSocket tidak terhubung', 'warning');
      }
    });
  });

  resetBtns.forEach(id => {
    document.getElementById(id)?.addEventListener('click', () => {
      if (socket?.connected) {
        socket.emit('resetMeasurement');
        measurementHistory = [];
        loadHistoryTable();
      }
    });
  });

  // Simulator button
  document.getElementById('btn-simulator')?.addEventListener('click', () => {
    navigateToPage('simulator');
  });

  document.getElementById('btn-export-csv')?.addEventListener('click', exportHistoryCSV);
  document.getElementById('btn-filter-history')?.addEventListener('click', loadHistoryTable);

  // Parameters form
  document.getElementById('parameters-form')?.addEventListener('submit', async e => {
    e.preventDefault();
    
    const params = {
      initialConcentration: parseFloat(document.getElementById('initial-concentration')?.value || 100),
      wavelength: parseFloat(document.getElementById('wavelength')?.value || 254),
      moldExtinctionCoeff: parseFloat(document.getElementById('extinction-coeff')?.value || 1000),
      pathLength: parseFloat(document.getElementById('path-length')?.value || 1)
    };

    try {
      const response = await fetch('/api/parameters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params)
      });

      const data = await response.json();
      if (data.success) {
        addNotification('✅ Parameter tersimpan', 'success');
      } else {
        addNotification('❌ Gagal menyimpan parameter', 'error');
      }
    } catch (error) {
      addNotification('❌ ' + error.message, 'error');
    }
  });
}

async function loadSystemParameters() {
  try {
    const response = await fetch('/api/parameters');
    const data = await response.json();
    
    if (data.success) {
      systemParameters = data.parameters;
      
      // Display in settings
      const els = {
        'initial-concentration': data.parameters.initialConcentration,
        'wavelength': data.parameters.wavelength,
        'extinction-coeff': data.parameters.moldExtinctionCoeff,
        'path-length': data.parameters.pathLength
      };

      Object.entries(els).forEach(([id, value]) => {
        const el = document.getElementById(id);
        if (el) el.value = value;
      });
    }
  } catch (error) {
    console.error('Error loading parameters:', error);
  }
}

// ============================================================================
// NOTIFICATIONS
// ============================================================================

function addNotification(message, type = 'info') {
  const notification = {
    id: Date.now(),
    message,
    type,
    timestamp: new Date().toLocaleTimeString('id-ID')
  };

  // Add to notification list
  const list = document.getElementById('notification-list');
  if (!list) {
    console.log(`[${type.toUpperCase()}] ${message}`);
    return;
  }

  const item = document.createElement('div');
  item.className = `notification-item notification-${type}`;
  item.innerHTML = `
    <div class="notification-message">${message}</div>
    <div class="notification-time">${notification.timestamp}</div>
  `;
  list.insertBefore(item, list.firstChild);

  // Keep only last 50
  while (list.children.length > 50) {
    list.removeChild(list.lastChild);
  }

  // Update badge
  const badge = document.getElementById('notification-badge');
  if (badge) {
    const count = list.children.length;
    badge.textContent = count;
    badge.classList.toggle('hidden', count === 0);
  }

  // Auto-remove after 5 seconds (safe closure)
  if (type !== 'error') {
    setTimeout(() => {
      // Check if element still exists
      if (item.parentNode) {
        item.parentNode.removeChild(item);
        // Update badge count
        if (badge) {
          const count = list.children.length;
          badge.textContent = count;
          badge.classList.toggle('hidden', count === 0);
        }
      }
    }, 5000);
  }

  console.log(`[${type.toUpperCase()}] ${message}`);
}


// ============================================================================
// ESP32 SIMULATOR
// ============================================================================

let simulatorState = {
  ultrasonicDistance: 25.5,
  rainStatus: 'BASAH',
  isAutoSimulating: false,
  autoSimulationInterval: null
};

function initializeSimulator() {
  console.log('🔧 Initializing Simulator...');
  
  // Debug: Check if elements exist
  console.log('Checking simulator elements:');
  console.log('- ultrasonic-slider:', document.getElementById('ultrasonic-slider'));
  console.log('- btn-rain-dry:', document.getElementById('btn-rain-dry'));
  console.log('- btn-rain-wet:', document.getElementById('btn-rain-wet'));
  console.log('- btn-send-data:', document.getElementById('btn-send-data'));
  console.log('- btn-auto-simulate:', document.getElementById('btn-auto-simulate'));
  
  // Update display values
  updateSimulatorDisplay();
  
  // Ultrasonic slider
  const ultrasonicSlider = document.getElementById('ultrasonic-slider');
  if (ultrasonicSlider) {
    ultrasonicSlider.addEventListener('input', (e) => {
      const value = parseFloat(e.target.value);
      simulatorState.ultrasonicDistance = value;
      updateSimulatorDisplay();
      addSimulationLog(`[DISTANCE] Jarak ultrasonic diubah: ${value.toFixed(1)} cm`);
    });
  }
  
  // Rain sensor buttons
  const dryBtn = document.getElementById('btn-rain-dry');
  const wetBtn = document.getElementById('btn-rain-wet');
  
  if (dryBtn) {
    dryBtn.addEventListener('click', () => {
      simulatorState.rainStatus = 'KERING';
      updateRainButtonStates();
      updateSimulatorDisplay();
      addSimulationLog('[RAIN] Sensor hujan: KERING');
    });
  }
  
  if (wetBtn) {
    wetBtn.addEventListener('click', () => {
      simulatorState.rainStatus = 'BASAH';
      updateRainButtonStates();
      updateSimulatorDisplay();
      addSimulationLog('[RAIN] Sensor hujan: BASAH');
    });
  }
  
  // Send data button
  const sendBtn = document.getElementById('btn-send-data');
  if (sendBtn) {
    sendBtn.addEventListener('click', sendSimulatorData);
  }
  
  // Auto simulate button
  const autoBtn = document.getElementById('btn-auto-simulate');
  if (autoBtn) {
    autoBtn.addEventListener('click', toggleAutoSimulation);
  }
  
  addSimulationLog('[INIT] Simulasi ESP32 siap dijalankan');
}

function updateRainButtonStates() {
  const dryBtn = document.getElementById('btn-rain-dry');
  const wetBtn = document.getElementById('btn-rain-wet');
  
  if (simulatorState.rainStatus === 'KERING') {
    dryBtn?.classList.add('active');
    wetBtn?.classList.remove('active');
  } else {
    wetBtn?.classList.add('active');
    dryBtn?.classList.remove('active');
  }
}

function updateSimulatorDisplay() {
  // Update ultrasonic display
  const ultrasonicValue = document.getElementById('ultrasonic-value');
  if (ultrasonicValue) {
    ultrasonicValue.textContent = simulatorState.ultrasonicDistance.toFixed(1);
  }
  
  // Determine ultrasonic status
  let ultrasonicStatus = simulatorState.ultrasonicDistance <= 50 ? 'DEKAT' : 'JAUH';
  const ultrasonicStatusEl = document.getElementById('ultrasonic-status');
  if (ultrasonicStatusEl) {
    ultrasonicStatusEl.innerHTML = `<span class="status-badge-sensor">${ultrasonicStatus}</span>`;
  }
  
  // Update rain display
  const rainText = document.getElementById('rain-text');
  if (rainText) {
    rainText.textContent = simulatorState.rainStatus;
  }
  
  // Update JSON display
  updateSimulatorJSON();
}

function updateSimulatorJSON() {
  const timestamp = new Date().toLocaleTimeString('id-ID');
  const ultrasonicStatus = simulatorState.ultrasonicDistance <= 50 ? 'DEKAT' : 'JAUH';
  
  const data = {
    timestamp: timestamp,
    ultrasonic_distance: parseFloat(simulatorState.ultrasonicDistance.toFixed(1)),
    ultrasonic_status: ultrasonicStatus,
    rain_sensor: simulatorState.rainStatus,
    esp_status: 'ONLINE',
    wifi_ssid: 'UBINNMASJIDD'
  };
  
  const jsonDisplay = document.getElementById('simulator-json');
  if (jsonDisplay) {
    jsonDisplay.textContent = JSON.stringify(data, null, 2);
  }
  
  return data;
}

function sendSimulatorData() {
  const data = updateSimulatorJSON();
  
  if (socket && socket.connected) {
    socket.emit('simulatorData', data);
    addNotification('[OK] Data simulator dikirim ke server', 'success');
    addSimulationLog(`[SEND] Data dikirim: Jarak=${data.ultrasonic_distance}cm, Hujan=${data.rain_sensor}`);
  } else {
    addNotification('[ERROR] WebSocket tidak terhubung', 'warning');
    addSimulationLog('[ERROR] Gagal mengirim data: WebSocket offline');
  }
}

function toggleAutoSimulation() {
  const autoBtn = document.getElementById('btn-auto-simulate');
  
  if (simulatorState.isAutoSimulating) {
    // Stop auto simulation
    simulatorState.isAutoSimulating = false;
    if (simulatorState.autoSimulationInterval) {
      clearInterval(simulatorState.autoSimulationInterval);
    }
    autoBtn.textContent = '[MULAI] Simulasi Otomatis';
    autoBtn.classList.remove('active');
    addSimulationLog('[STOP] Simulasi otomatis dihentikan');
  } else {
    // Start auto simulation
    simulatorState.isAutoSimulating = true;
    autoBtn.textContent = '[BERJALAN...] Simulasi Otomatis';
    autoBtn.classList.add('active');
    addSimulationLog('[START] Simulasi otomatis dimulai');
    
    simulatorState.autoSimulationInterval = setInterval(() => {
      // Simulate ultrasonic distance changes
      const randomChange = (Math.random() - 0.5) * 20;
      let newDistance = simulatorState.ultrasonicDistance + randomChange;
      newDistance = Math.max(5, Math.min(200, newDistance));
      
      simulatorState.ultrasonicDistance = newDistance;
      
      // Randomly change rain status every 5 iterations (every 5 seconds)
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
  const logContainer = document.getElementById('simulation-log');
  if (!logContainer) return;
  
  const timestamp = new Date().toLocaleTimeString('id-ID');
  const logEntry = document.createElement('p');
  logEntry.className = 'log-entry';
  logEntry.textContent = `[${timestamp}] ${message}`;
  
  logContainer.appendChild(logEntry);
  logContainer.scrollTop = logContainer.scrollHeight;
  
  // Keep only last 20 logs
  const entries = logContainer.querySelectorAll('.log-entry');
  if (entries.length > 20) {
    entries[0].remove();
  }
}

// ============================================================================
// ESP32 REAL SENSOR
// ============================================================================

let esp32RealData = {
  distance: 0,
  rainStatus: "KERING",
  status: "OFFLINE",
  lastUpdate: null
};

function initializeEsp32RealSensor() {
  console.log('[ESP32] Initialize real sensor display');
  
  // Load initial data
  fetchEsp32Status();
  
  // Refresh button
  const refreshBtn = document.getElementById('btn-refresh-esp32');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', fetchEsp32Status);
  }
  
  // Auto refresh every 5 seconds
  setInterval(fetchEsp32Status, 5000);
}

function fetchEsp32Status() {
  fetch('/api/esp32/status')
    .then(response => response.json())
    .then(data => {
      if (data.success && data.esp32Data) {
        updateEsp32Display(data.esp32Data);
      }
    })
    .catch(error => console.error('[ESP32] Fetch error:', error));
}

function updateEsp32Display(data) {
  console.log('[ESP32] Updating display:', data);
  
  esp32RealData = data;
  
  // Update distance
  const distanceEl = document.getElementById('esp32-distance');
  if (distanceEl && data.distance !== undefined) {
    distanceEl.textContent = data.distance.toFixed(1);
  }
  
  // Update distance status
  const statusEl = document.getElementById('esp32-distance-status');
  if (statusEl && data.distanceStatus) {
    statusEl.innerHTML = `<span class="status-badge-sensor">${data.distanceStatus}</span>`;
  }
  
  // Update rain status
  const rainEl = document.getElementById('esp32-rain');
  if (rainEl) {
    rainEl.textContent = data.rainStatus || '-';
  }
  
  // Update rain icon
  const rainIcon = document.querySelector('#esp32-rain-display .rain-icon');
  if (rainIcon) {
    rainIcon.textContent = data.rainStatus === 'BASAH' ? '💧' : '☀️';
  }
  
  // Update WiFi signal
  const rssiEl = document.getElementById('esp32-rssi');
  if (rssiEl && data.wifiSignal) {
    rssiEl.textContent = data.wifiSignal;
  }
  
  // Update connection status
  const connEl = document.getElementById('esp32-connection');
  if (connEl) {
    connEl.textContent = data.status || 'OFFLINE';
  }
  
  // Update status badge
  const badgeEl = document.getElementById('esp32-status-badge');
  if (badgeEl) {
    badgeEl.textContent = data.status === 'ONLINE' ? 'ONLINE' : 'OFFLINE';
    badgeEl.style.background = data.status === 'ONLINE' ? '#4CAF50' : '#ccc';
  }
  
  // Update last update time
  const timeEl = document.getElementById('esp32-last-update');
  if (timeEl && data.timestamp) {
    timeEl.textContent = data.timestamp;
  }
  
  // Update raw JSON display
  const rawEl = document.getElementById('esp32-raw-data');
  if (rawEl) {
    rawEl.textContent = JSON.stringify(data, null, 2);
  }
  
  addNotification('[OK] Data ESP32 diperbarui', 'success');
}

// ============================================================================
// PWA
// ============================================================================

function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js')
      .then(reg => console.log('✅ Service Worker registered'))
      .catch(err => console.error('❌ Service Worker failed:', err));
  }
}

console.log('✅ app.js loaded');
