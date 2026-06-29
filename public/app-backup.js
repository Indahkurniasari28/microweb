// ============================================================================
// MICROWAT - Main Application JS (Simplified)
// ============================================================================

// Firebase & Auth variables
let auth, database;
let currentUser = null;
let socket = null;

// Data containers
let measurementHistory = [];
let chartInstances = {};
let notifications = [];

// Initialize on DOM load
window.addEventListener('DOMContentLoaded', initializeApp);

/**
 * Initialize the application
 */
function initializeApp() {
  console.log('🚀 Initializing MICROWAT Application...');

  // Initialize Firebase first
  if (typeof firebase !== 'undefined') {
    try {
      auth = firebase.auth();
      database = firebase.database();
      console.log('✅ Firebase initialized');
    } catch (error) {
      console.error('❌ Firebase init error:', error);
    }
  } else {
    console.error('❌ Firebase not loaded');
    return;
  }

  // Initialize Socket.io for real-time communication
  if (typeof io !== 'undefined') {
    initializeSocket();
  }

  // Setup event listeners
  setupAuthFormListeners();
  setupPageNavigation();
  setupMeasurementControlButtons();
  setupNotificationPanel();

  // Check authentication state
  checkAuthState();

  // Register service worker for PWA
  registerServiceWorker();

  console.log('✅ App initialization complete');
}

/**
 * Initialize Socket.io connection
 */
function initializeSocket() {
  socket = io();

  socket.on('connect', () => {
    console.log('✅ WebSocket connected');
    updateSystemStatus('mqtt', 'online');
  });

  socket.on('disconnect', () => {
    console.log('❌ WebSocket disconnected');
    updateSystemStatus('mqtt', 'offline');
  });

  socket.on('spectrometerUpdate', data => {
    console.log('📊 Measurement received:', data);
    updateMeasurementDisplay(data);
    addNotification('📊 Data baru diterima', 'info');
  });

  socket.on('statusUpdate', data => {
    updateSystemStatus('hardware', data.status === 'online' ? 'online' : 'offline');
  });

  socket.on('measurementStatus', data => {
    updateSystemStatus('measuring', data.measuring ? 'online' : 'offline');
  });
}

// ============================================================================
// AUTHENTICATION FUNCTIONS
// ============================================================================

function setupAuthFormListeners() {
  // Toggle forms
  const registerLink = document.getElementById('register-link');
  const loginLink = document.getElementById('login-link');
  const forgotLink = document.getElementById('forgot-password-link');
  const backLink = document.getElementById('back-to-login');

  if (registerLink) registerLink.addEventListener('click', e => {
    e.preventDefault();
    toggleAuthSection('register-section');
  });

  if (loginLink) loginLink.addEventListener('click', e => {
    e.preventDefault();
    toggleAuthSection('login-section');
  });

  if (forgotLink) forgotLink.addEventListener('click', e => {
    e.preventDefault();
    toggleAuthSection('reset-section');
  });

  if (backLink) backLink.addEventListener('click', e => {
    e.preventDefault();
    toggleAuthSection('login-section');
  });

  // Login form
  const loginForm = document.getElementById('login-form');
  if (loginForm) {
    loginForm.addEventListener('submit', async e => {
      e.preventDefault();
      const email = document.getElementById('login-email').value;
      const password = document.getElementById('login-password').value;
      
      try {
        await auth.signInWithEmailAndPassword(email, password);
        console.log('✅ Login successful');
        clearAuthForms();
      } catch (error) {
        showAuthError('login', error.message);
        console.error('❌ Login error:', error);
      }
    });
  }

  // Register form
  const registerForm = document.getElementById('register-form');
  if (registerForm) {
    registerForm.addEventListener('submit', async e => {
      e.preventDefault();
      const email = document.getElementById('register-email').value;
      const password = document.getElementById('register-password').value;
      const confirm = document.getElementById('register-confirm').value;

      if (password !== confirm) {
        showAuthError('register', 'Kata sandi tidak cocok');
        return;
      }

      try {
        await auth.createUserWithEmailAndPassword(email, password);
        console.log('✅ Registration successful');
        clearAuthForms();
      } catch (error) {
        showAuthError('register', error.message);
        console.error('❌ Register error:', error);
      }
    });
  }

  // Reset password form
  const resetForm = document.getElementById('reset-form');
  if (resetForm) {
    resetForm.addEventListener('submit', async e => {
      e.preventDefault();
      const email = document.getElementById('reset-email').value;

      try {
        await auth.sendPasswordResetEmail(email);
        alert('✅ Email reset telah dikirim ke: ' + email);
        toggleAuthSection('login-section');
      } catch (error) {
        showAuthError('reset', error.message);
        console.error('❌ Reset error:', error);
      }
    });
  }

  // Logout button
  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      try {
        await auth.signOut();
        console.log('✅ Logout successful');
        currentUser = null;
      } catch (error) {
        console.error('❌ Logout error:', error);
      }
    });
  }
}

function toggleAuthSection(sectionId) {
  document.querySelectorAll('.auth-section').forEach(section => {
    section.classList.add('hidden');
  });
  const section = document.getElementById(sectionId);
  if (section) section.classList.remove('hidden');
}

function showAuthError(section, message) {
  const errorElement = document.getElementById(`${section}-error`);
  if (errorElement) {
    errorElement.textContent = '❌ ' + message;
    errorElement.classList.remove('hidden');
  }
}

function clearAuthForms() {
  document.querySelectorAll('input[type="email"], input[type="password"]').forEach(input => {
    input.value = '';
  });
  document.querySelectorAll('.error-message').forEach(error => {
    error.classList.add('hidden');
  });
}

function checkAuthState() {
  if (!auth) return;

  auth.onAuthStateChanged(user => {
    currentUser = user;
    if (user) {
      console.log('✅ User signed in:', user.email);
      showMainApp();
      updateUserDisplay(user.email);
      loadMeasurementsHistory();
    } else {
      console.log('❌ User not signed in');
      showAuthContainer();
    }
  });
}

function showAuthContainer() {
  const authContainer = document.getElementById('auth-container');
  const mainApp = document.getElementById('main-app');
  
  if (authContainer) {
    authContainer.classList.remove('hidden');
    if (authContainer.classList.contains('auth-full-screen')) {
      authContainer.classList.remove('hidden');
    }
  }
  if (mainApp) mainApp.classList.add('hidden');
  
  console.log('📝 Showing auth container');
}

function showMainApp() {
  const authContainer = document.getElementById('auth-container');
  const mainApp = document.getElementById('main-app');
  
  if (authContainer) authContainer.classList.add('hidden');
  if (mainApp) mainApp.classList.remove('hidden');
  
  console.log('✅ Showing main app');
}

function updateUserDisplay(email) {
  const userEmail = document.getElementById('user-email-display');
  const settingsEmail = document.getElementById('settings-email');
  
  if (userEmail) userEmail.textContent = email;
  if (settingsEmail) settingsEmail.value = email;
}

// ============================================================================
// PAGE NAVIGATION
// ============================================================================

function setupPageNavigation() {
  document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', e => {
      e.preventDefault();
      const pageName = link.dataset.page;
      navigateToPage(pageName);
    });
  });
}

function navigateToPage(pageName) {
  // Update nav links
  document.querySelectorAll('.nav-link').forEach(link => {
    link.classList.toggle('active', link.dataset.page === pageName);
  });

  // Update pages
  document.querySelectorAll('.page').forEach(page => {
    page.classList.add('hidden');
  });
  const page = document.getElementById(`${pageName}-page`);
  if (page) page.classList.remove('hidden');

  // Update page title
  const titles = {
    dashboard: 'Dashboard',
    monitoring: 'Monitoring',
    history: 'Riwayat Data',
    controls: 'Kontrol Sistem',
    settings: 'Pengaturan'
  };
  const titleEl = document.getElementById('page-title');
  if (titleEl) titleEl.textContent = titles[pageName] || 'MICROWAT';

  console.log('📄 Navigating to:', pageName);
}

// ============================================================================
// MEASUREMENT DISPLAY
// ============================================================================

function updateMeasurementDisplay(measurement) {
  if (!measurement) return;

  document.getElementById('absorbance-value').textContent = 
    (measurement.absorbance || 0).toFixed(3);
  
  document.getElementById('concentration-value').textContent = 
    (measurement.concentration || 0).toFixed(2);
  
  document.getElementById('degradation-value').textContent = 
    (measurement.degradation || 0).toFixed(1) + '%';

  const progressBar = document.getElementById('degradation-progress');
  if (progressBar) {
    progressBar.style.width = (measurement.degradation || 0) + '%';
  }

  if (measurement.timestamp) {
    const time = new Date(measurement.timestamp).toLocaleTimeString('id-ID');
    const ts = document.getElementById('measure-timestamp');
    if (ts) ts.textContent = time;
    
    const last = document.getElementById('last-update-time');
    if (last) last.textContent = time;
  }

  updateStatusBadge(measurement);

  if (measurement.status) {
    updateSystemStatus('hardware', measurement.status === 'online' ? 'online' : 'offline');
  }

  // Update detail fields
  const fields = {
    'detail-timestamp': measurement.timestamp || '-',
    'detail-absorbance': (measurement.absorbance || 0).toFixed(3),
    'detail-concentration': (measurement.concentration || 0).toFixed(2) + ' ppm',
    'detail-degradation': (measurement.degradation || 0).toFixed(1) + '%',
    'detail-wavelength': measurement.wavelength || '254'
  };

  Object.entries(fields).forEach(([id, value]) => {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  });

  measurementHistory.push(measurement);
  if (measurementHistory.length > 1000) {
    measurementHistory.shift();
  }
}

function updateStatusBadge(measurement) {
  const badge = document.getElementById('status-badge');
  if (!badge) return;

  let status = 'IDLE';
  let color = '#999';

  if (measurement.degradation >= 90) {
    status = '✓ SELESAI';
    color = '#4CAF50';
  } else if (measurement.degradation >= 50) {
    status = '⟳ BERLANGSUNG';
    color = '#2196F3';
  } else if (measurement.degradation > 0) {
    status = '▶ DIMULAI';
    color = '#FF9800';
  } else {
    status = '■ IDLE';
    color = '#999';
  }

  badge.textContent = status;
  badge.style.backgroundColor = color;
}

function updateSystemStatus(type, status) {
  const statusMap = {
    hardware: 'hardware-status',
    measuring: 'measuring-status',
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
      const isOnline = status === 'online';
      dot.classList.toggle('status-online', isOnline);
      dot.classList.toggle('status-offline', !isOnline);
      text.textContent = isOnline ? 'Online' : 'Offline';
    }
  }
}

// ============================================================================
// CONTROLS
// ============================================================================

function setupMeasurementControlButtons() {
  const btns = [
    ['btn-start-measurement', 'microwat/control/start', '1'],
    ['btn-stop-measurement', 'microwat/control/stop', '0'],
    ['btn-refresh-data', null, null],
    ['btn-control-start', 'microwat/control/start', '1'],
    ['btn-control-stop', 'microwat/control/stop', '0'],
    ['btn-control-reset', 'microwat/control/reset', '1']
  ];

  btns.forEach(([btnId, topic, msg]) => {
    const btn = document.getElementById(btnId);
    if (btn) {
      btn.addEventListener('click', () => {
        if (topic && msg) {
          publishMQTT(topic, msg);
        } else if (btnId === 'btn-refresh-data') {
          loadMeasurementsHistory();
          addNotification('🔄 Data dimuat ulang', 'info');
        }
      });
    }
  });

  // Parameters form
  const paramForm = document.getElementById('parameters-form');
  if (paramForm) {
    paramForm.addEventListener('submit', async e => {
      e.preventDefault();
      const params = {
        initialConcentration: parseFloat(document.getElementById('initial-concentration').value) || 0,
        wavelength: parseFloat(document.getElementById('wavelength').value) || 254,
        moldExtinctionCoeff: parseFloat(document.getElementById('extinction-coeff').value) || 1000,
        pathLength: parseFloat(document.getElementById('path-length').value) || 1
      };

      try {
        const response = await fetch('/api/parameters', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(params)
        });

        if (response.ok) {
          addNotification('✓ Parameter tersimpan', 'success');
        } else {
          addNotification('✗ Gagal menyimpan', 'error');
        }
      } catch (error) {
        addNotification('✗ Error: ' + error.message, 'error');
      }
    });
  }

  // Export CSV
  const exportBtn = document.getElementById('btn-export-csv');
  if (exportBtn) {
    exportBtn.addEventListener('click', exportHistoryCSV);
  }

  // Filter history
  const filterBtn = document.getElementById('btn-filter-history');
  if (filterBtn) {
    filterBtn.addEventListener('click', loadHistoryTable);
  }
}

function publishMQTT(topic, message) {
  if (socket && socket.connected) {
    socket.emit('publish', { topic, message });
    console.log('📤 Published:', topic, message);
    addNotification('📤 Perintah dikirim', 'info');
  } else {
    addNotification('✗ WebSocket tidak aktif', 'error');
  }
}

// ============================================================================
// HISTORY & DATA
// ============================================================================

async function loadMeasurementsHistory() {
  try {
    const response = await fetch('/api/measurements');
    const data = await response.json();
    measurementHistory = Array.isArray(data) ? data.sort((a, b) => 
      new Date(a.timestamp) - new Date(b.timestamp)
    ) : [];
    console.log('✅ Loaded', measurementHistory.length, 'measurements');
  } catch (error) {
    console.error('❌ Error loading history:', error);
  }
}

function loadHistoryTable() {
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

  filtered.forEach(m => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${new Date(m.timestamp).toLocaleString('id-ID')}</td>
      <td>${(m.absorbance || 0).toFixed(3)}</td>
      <td>${(m.concentration || 0).toFixed(2)}</td>
      <td>${(m.degradation || 0).toFixed(1)}%</td>
      <td>${m.status || 'Auto'}</td>
    `;
    tbody.appendChild(row);
  });
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

  const blob = new Blob([csv], { type: 'text/csv' });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `microwat-${new Date().toISOString().split('T')[0]}.csv`;
  link.click();
  window.URL.revokeObjectURL(url);
}

// ============================================================================
// NOTIFICATIONS
// ============================================================================

function setupNotificationPanel() {
  const btn = document.getElementById('notification-btn');
  const panel = document.getElementById('notification-panel');
  const clearBtn = document.getElementById('clear-notifications');

  if (btn && panel) {
    btn.addEventListener('click', () => {
      panel.classList.toggle('hidden');
    });
  }

  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      notifications = [];
      updateNotificationPanel();
    });
  }

  document.addEventListener('click', e => {
    if (btn && panel && !panel.contains(e.target) && !btn.contains(e.target)) {
      panel.classList.add('hidden');
    }
  });
}

function addNotification(message, type = 'info') {
  const notification = {
    id: Date.now(),
    message,
    type,
    timestamp: new Date().toLocaleTimeString('id-ID')
  };

  notifications.unshift(notification);
  if (notifications.length > 50) notifications.pop();

  updateNotificationPanel();

  setTimeout(() => {
    notifications = notifications.filter(n => n.id !== notification.id);
    updateNotificationPanel();
  }, 5000);
}

function updateNotificationPanel() {
  const list = document.getElementById('notification-list');
  const badge = document.getElementById('notification-badge');

  if (!list) return;

  if (notifications.length === 0) {
    list.innerHTML = '<p class="empty-state">Tidak ada notifikasi</p>';
    if (badge) badge.classList.add('hidden');
    return;
  }

  if (badge) {
    badge.classList.remove('hidden');
    badge.textContent = notifications.length;
  }

  list.innerHTML = notifications.map(n => `
    <div class="notification-item notification-${n.type}">
      <div class="notification-message">${n.message}</div>
      <div class="notification-time">${n.timestamp}</div>
    </div>
  `).join('');
}

// ============================================================================
// PWA
// ============================================================================

function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js')
      .then(reg => {
        console.log('✅ Service Worker registered');
      })
      .catch(error => {
        console.error('❌ Service Worker registration failed:', error);
      });
  }
}

console.log('✅ app.js loaded');

/**
 * Initialize the application
 */
async function initializeApp() {
  console.log('🚀 Initializing MICROWAT Application...');

  // Wait for Firebase to be available
  if (typeof firebase !== 'undefined') {
    initializeFirebase();
  } else {
    console.error('❌ Firebase not loaded');
    return;
  }

  // Initialize Socket.io for real-time communication
  initializeSocket();

  // Setup event listeners
  setupAuthFormListeners();
  setupPageNavigation();
  setupMeasurementControlButtons();
  setupNotificationPanel();

  // Check authentication state
  checkAuthState();

  // Register service worker for PWA
  registerServiceWorker();
}

/**
 * Initialize Firebase
 */
function initializeFirebase() {
  try {
    auth = firebase.auth();
    database = firebase.database();
    console.log('✅ Firebase initialized');

    auth.onAuthStateChanged(user => {
      currentUser = user;
      if (user) {
        console.log('✅ User logged in:', user.email);
        showMainApp();
        updateUserDisplay(user.email);
        loadMeasurementsHistory();
      } else {
        console.log('❌ User not logged in');
        showAuthContainer();
      }
    });
  } catch (error) {
    console.error('❌ Firebase initialization failed:', error);
  }
}

/**
 * Initialize Socket.io connection
 */
function initializeSocket() {
  socket = io();

  socket.on('connect', () => {
    console.log('✅ WebSocket connected:', socket.id);
    updateSystemStatus('mqtt', 'online');
  });

  socket.on('disconnect', () => {
    console.log('❌ WebSocket disconnected');
    updateSystemStatus('mqtt', 'offline');
  });

  // Listen for real-time spectrometer updates
  socket.on('spectrometerUpdate', data => {
    console.log('📊 Measurement update received:', data);
    updateMeasurementDisplay(data);
    addNotification('📊 Pengukuran baru diterima', 'info');
  });

  // Listen for status updates
  socket.on('statusUpdate', data => {
    console.log('📡 Status update:', data);
    updateSystemStatus('hardware', data.status === 'online' ? 'online' : 'offline');
  });

  socket.on('measurementStatus', data => {
    console.log('⏱️  Measurement status:', data);
    const status = data.measuring ? 'online' : 'offline';
    updateSystemStatus('measuring', status);
  });
}

// ============================================================================
// AUTHENTICATION FUNCTIONS
// ============================================================================

function setupAuthFormListeners() {
  // Toggle between login and register
  document.getElementById('register-link')?.addEventListener('click', (e) => {
    e.preventDefault();
    toggleAuthSection('register-section');
  });

  document.getElementById('login-link')?.addEventListener('click', (e) => {
    e.preventDefault();
    toggleAuthSection('login-section');
  });

  document.getElementById('forgot-password-link')?.addEventListener('click', (e) => {
    e.preventDefault();
    toggleAuthSection('reset-section');
  });

  document.getElementById('back-to-login')?.addEventListener('click', (e) => {
    e.preventDefault();
    toggleAuthSection('login-section');
  });

  // Login form
  document.getElementById('login-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    
    try {
      await auth.signInWithEmailAndPassword(email, password);
      console.log('✅ Login successful');
      clearAuthForms();
    } catch (error) {
      showAuthError('login', error.message);
    }
  });

  // Register form
  document.getElementById('register-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('register-email').value;
    const password = document.getElementById('register-password').value;
    const confirm = document.getElementById('register-confirm').value;

    if (password !== confirm) {
      showAuthError('register', 'Kata sandi tidak cocok');
      return;
    }

    try {
      await auth.createUserWithEmailAndPassword(email, password);
      console.log('✅ Registration successful');
      clearAuthForms();
    } catch (error) {
      showAuthError('register', error.message);
    }
  });

  // Reset password form
  document.getElementById('reset-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('reset-email').value;

    try {
      await auth.sendPasswordResetEmail(email);
      alert('Email reset kata sandi telah dikirim ke: ' + email);
      toggleAuthSection('login-section');
    } catch (error) {
      showAuthError('reset', error.message);
    }
  });

  // Logout button
  document.getElementById('logout-btn')?.addEventListener('click', async () => {
    try {
      await auth.signOut();
      console.log('✅ Logout successful');
      currentUser = null;
    } catch (error) {
      console.error('❌ Logout error:', error);
    }
  });
}

function toggleAuthSection(sectionId) {
  document.querySelectorAll('.auth-section').forEach(section => {
    section.classList.add('hidden');
  });
  document.getElementById(sectionId)?.classList.remove('hidden');
}

function showAuthError(section, message) {
  const errorElement = document.getElementById(`${section}-error`);
  if (errorElement) {
    errorElement.textContent = message;
    errorElement.classList.remove('hidden');
  }
}

function clearAuthForms() {
  document.querySelectorAll('input[type="email"], input[type="password"]').forEach(input => {
    input.value = '';
  });
  document.querySelectorAll('.error-message').forEach(error => {
    error.classList.add('hidden');
  });
}

function checkAuthState() {
  auth.onAuthStateChanged(user => {
    if (user) {
      showMainApp();
      updateUserDisplay(user.email);
    } else {
      showAuthContainer();
    }
  });
}

function showAuthContainer() {
  document.getElementById('auth-container').classList.remove('hidden');
  document.getElementById('main-app').classList.add('hidden');
}

function showMainApp() {
  document.getElementById('auth-container').classList.add('hidden');
  document.getElementById('main-app').classList.remove('hidden');
}

function updateUserDisplay(email) {
  document.getElementById('user-email-display').textContent = email;
  document.getElementById('settings-email').value = email;
}

// ============================================================================
// PAGE NAVIGATION
// ============================================================================

function setupPageNavigation() {
  document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const pageName = link.dataset.page;
      navigateToPage(pageName);
    });
  });
}

function navigateToPage(pageName) {
  // Update nav links
  document.querySelectorAll('.nav-link').forEach(link => {
    link.classList.toggle('active', link.dataset.page === pageName);
  });

  // Update pages
  document.querySelectorAll('.page').forEach(page => {
    page.classList.add('hidden');
  });
  document.getElementById(`${pageName}-page`)?.classList.remove('hidden');

  // Update page title
  const titles = {
    dashboard: 'Dashboard',
    monitoring: 'Monitoring',
    history: 'Riwayat Data',
    controls: 'Kontrol Sistem',
    settings: 'Pengaturan'
  };
  document.getElementById('page-title').textContent = titles[pageName] || 'MICROWAT';

  // Initialize page-specific features
  if (pageName === 'dashboard') {
    initializeRealtimeChart();
  } else if (pageName === 'monitoring') {
    initializeMonitoringChart();
  } else if (pageName === 'history') {
    loadHistoryTable();
  }
}

// ============================================================================
// MEASUREMENT DISPLAY & UPDATES
// ============================================================================

function updateMeasurementDisplay(measurement) {
  if (!measurement) return;

  // Update primary values
  document.getElementById('absorbance-value').textContent = 
    (measurement.absorbance || 0).toFixed(3);
  
  document.getElementById('concentration-value').textContent = 
    (measurement.concentration || 0).toFixed(2);
  
  document.getElementById('degradation-value').textContent = 
    (measurement.degradation || 0).toFixed(1) + '%';

  // Update progress bar
  const progressBar = document.getElementById('degradation-progress');
  if (progressBar) {
    progressBar.style.width = (measurement.degradation || 0) + '%';
  }

  // Update timestamp
  if (measurement.timestamp) {
    const time = new Date(measurement.timestamp).toLocaleTimeString('id-ID');
    document.getElementById('measure-timestamp').textContent = time;
    document.getElementById('last-update-time').textContent = time;
  }

  // Update status badge
  updateStatusBadge(measurement);

  // Update hardware status
  if (measurement.status) {
    updateSystemStatus('hardware', measurement.status === 'online' ? 'online' : 'offline');
  }

  // Update detail fields
  document.getElementById('detail-timestamp').textContent = measurement.timestamp || '-';
  document.getElementById('detail-absorbance').textContent = (measurement.absorbance || 0).toFixed(3);
  document.getElementById('detail-concentration').textContent = (measurement.concentration || 0).toFixed(2) + ' ppm';
  document.getElementById('detail-degradation').textContent = (measurement.degradation || 0).toFixed(1) + '%';
  document.getElementById('detail-wavelength').textContent = measurement.wavelength || '254';

  // Add to history
  measurementHistory.push(measurement);
  if (measurementHistory.length > 1000) {
    measurementHistory.shift(); // Keep only last 1000
  }

  // Update charts if they exist
  if (chartInstances.realtime) {
    updateRealtimeChart(measurement);
  }
}

function updateStatusBadge(measurement) {
  const badge = document.getElementById('status-badge');
  if (!badge) return;

  let status = 'IDLE';
  let color = '#999';

  if (measurement.degradation >= 90) {
    status = '✓ SELESAI';
    color = '#4CAF50';
  } else if (measurement.degradation >= 50) {
    status = '⟳ BERLANGSUNG';
    color = '#2196F3';
  } else if (measurement.degradation > 0) {
    status = '▶ DIMULAI';
    color = '#FF9800';
  } else {
    status = '■ IDLE';
    color = '#999';
  }

  badge.textContent = status;
  badge.style.backgroundColor = color;
}

function updateSystemStatus(type, status) {
  const statusMap = {
    hardware: 'hardware-status',
    measuring: 'measuring-status',
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

  // Update main status indicator
  if (type === 'hardware') {
    const dot = document.getElementById('system-status');
    const text = document.getElementById('system-status-text');
    if (dot && text) {
      const isOnline = status === 'online';
      dot.classList.toggle('status-online', isOnline);
      dot.classList.toggle('status-offline', !isOnline);
      text.textContent = isOnline ? 'Online' : 'Offline';
    }
  }
}

// ============================================================================
// REAL-TIME CHARTS
// ============================================================================

function initializeRealtimeChart() {
  const ctx = document.getElementById('realtimeChart')?.getContext('2d');
  if (!ctx) return;

  if (chartInstances.realtime) {
    chartInstances.realtime.destroy();
  }

  chartInstances.realtime = new Chart(ctx, {
    type: 'line',
    data: {
      labels: [],
      datasets: [
        {
          label: 'Konsentrasi (ppm)',
          data: [],
          borderColor: '#2196F3',
          backgroundColor: 'rgba(33, 150, 243, 0.1)',
          tension: 0.4,
          yAxisID: 'y'
        },
        {
          label: 'Degradasi (%)',
          data: [],
          borderColor: '#4CAF50',
          backgroundColor: 'rgba(76, 175, 80, 0.1)',
          tension: 0.4,
          yAxisID: 'y1'
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: {
          position: 'top'
        },
        title: {
          display: false
        }
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
          title: { display: true, text: 'Degradasi (%)' },
          max: 100
        }
      }
    }
  });
}

function updateRealtimeChart(measurement) {
  const chart = chartInstances.realtime;
  if (!chart) return;

  const time = new Date(measurement.timestamp).toLocaleTimeString('id-ID');
  
  chart.data.labels.push(time);
  chart.data.datasets[0].data.push(measurement.concentration || 0);
  chart.data.datasets[1].data.push(measurement.degradation || 0);

  // Keep only last 50 points
  if (chart.data.labels.length > 50) {
    chart.data.labels.shift();
    chart.data.datasets[0].data.shift();
    chart.data.datasets[1].data.shift();
  }

  chart.update();
}

function initializeMonitoringChart() {
  const ctx = document.getElementById('monitoringChart')?.getContext('2d');
  if (!ctx) return;

  if (chartInstances.monitoring) {
    chartInstances.monitoring.destroy();
  }

  const labels = measurementHistory.map((m, i) => {
    if (i % Math.ceil(measurementHistory.length / 10) === 0) {
      return new Date(m.timestamp).toLocaleTimeString('id-ID');
    }
    return '';
  });

  const absorbances = measurementHistory.map(m => m.absorbance || 0);
  const concentrations = measurementHistory.map(m => m.concentration || 0);
  const degradations = measurementHistory.map(m => m.degradation || 0);

  chartInstances.monitoring = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Absorbansi (A)',
          data: absorbances,
          borderColor: '#FF5722',
          backgroundColor: 'rgba(255, 87, 34, 0.1)',
          tension: 0.4
        },
        {
          label: 'Konsentrasi (ppm)',
          data: concentrations,
          borderColor: '#2196F3',
          backgroundColor: 'rgba(33, 150, 243, 0.1)',
          tension: 0.4
        },
        {
          label: 'Degradasi (%)',
          data: degradations,
          borderColor: '#4CAF50',
          backgroundColor: 'rgba(76, 175, 80, 0.1)',
          tension: 0.4
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: { position: 'top' }
      }
    }
  });
}

// ============================================================================
// MEASUREMENT CONTROLS
// ============================================================================

function setupMeasurementControlButtons() {
  // Dashboard quick actions
  document.getElementById('btn-start-measurement')?.addEventListener('click', () => {
    publishMQTT('microwat/control/start', '1');
    addNotification('▶ Perintah mulai pengukuran dikirim', 'info');
  });

  document.getElementById('btn-stop-measurement')?.addEventListener('click', () => {
    publishMQTT('microwat/control/stop', '0');
    addNotification('■ Perintah henti pengukuran dikirim', 'info');
  });

  document.getElementById('btn-refresh-data')?.addEventListener('click', () => {
    loadMeasurementsHistory();
    addNotification('🔄 Data dimuat ulang', 'info');
  });

  // Controls page buttons
  document.getElementById('btn-control-start')?.addEventListener('click', () => {
    publishMQTT('microwat/control/start', '1');
  });

  document.getElementById('btn-control-stop')?.addEventListener('click', () => {
    publishMQTT('microwat/control/stop', '0');
  });

  document.getElementById('btn-control-reset')?.addEventListener('click', () => {
    publishMQTT('microwat/control/reset', '1');
  });

  // Parameters form
  document.getElementById('parameters-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const params = {
      initialConcentration: parseFloat(document.getElementById('initial-concentration').value) || 0,
      wavelength: parseFloat(document.getElementById('wavelength').value) || 254,
      moldExtinctionCoeff: parseFloat(document.getElementById('extinction-coeff').value) || 1000,
      pathLength: parseFloat(document.getElementById('path-length').value) || 1
    };

    try {
      const response = await fetch('/api/parameters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params)
      });

      if (response.ok) {
        addNotification('✓ Parameter berhasil disimpan', 'success');
      } else {
        addNotification('✗ Gagal menyimpan parameter', 'error');
      }
    } catch (error) {
      console.error('❌ Error saving parameters:', error);
      addNotification('✗ Error: ' + error.message, 'error');
    }
  });

  // History export
  document.getElementById('btn-export-csv')?.addEventListener('click', () => {
    exportHistoryCSV();
  });

  // History filter
  document.getElementById('btn-filter-history')?.addEventListener('click', () => {
    loadHistoryTable();
  });
}

function publishMQTT(topic, message) {
  if (socket && socket.connected) {
    socket.emit('publish', { topic, message });
    console.log('📤 Published:', topic, message);
  } else {
    addNotification('✗ Koneksi WebSocket tidak aktif', 'error');
  }
}

// ============================================================================
// HISTORY & DATA MANAGEMENT
// ============================================================================

async function loadMeasurementsHistory() {
  try {
    const response = await fetch('/api/measurements?days=7');
    const data = await response.json();
    measurementHistory = data.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    console.log('✅ Loaded', measurementHistory.length, 'historical measurements');
  } catch (error) {
    console.error('❌ Error loading history:', error);
  }
}

function loadHistoryTable() {
  const tbody = document.getElementById('history-table-body');
  if (!tbody) return;

  // Get date filters
  const fromDate = document.getElementById('history-date-from')?.value || '';
  const toDate = document.getElementById('history-date-to')?.value || '';

  // Filter measurements
  let filtered = measurementHistory;
  if (fromDate || toDate) {
    filtered = measurementHistory.filter(m => {
      const date = new Date(m.timestamp).toISOString().split('T')[0];
      if (fromDate && date < fromDate) return false;
      if (toDate && date > toDate) return false;
      return true;
    });
  }

  // Populate table
  tbody.innerHTML = '';
  if (filtered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="empty-state">Tidak ada data</td></tr>';
    return;
  }

  filtered.forEach(m => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${new Date(m.timestamp).toLocaleString('id-ID')}</td>
      <td>${(m.absorbance || 0).toFixed(3)}</td>
      <td>${(m.concentration || 0).toFixed(2)}</td>
      <td>${(m.degradation || 0).toFixed(1)}%</td>
      <td>${m.status || 'Auto'}</td>
    `;
    tbody.appendChild(row);
  });
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

  const blob = new Blob([csv], { type: 'text/csv' });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `microwat-data-${new Date().toISOString().split('T')[0]}.csv`;
  link.click();
}

// ============================================================================
// NOTIFICATION SYSTEM
// ============================================================================

function setupNotificationPanel() {
  document.getElementById('notification-btn')?.addEventListener('click', () => {
    const panel = document.getElementById('notification-panel');
    panel?.classList.toggle('hidden');
  });

  document.getElementById('clear-notifications')?.addEventListener('click', () => {
    notifications = [];
    updateNotificationPanel();
  });

  // Close panel when clicking outside
  document.addEventListener('click', (e) => {
    const panel = document.getElementById('notification-panel');
    const btn = document.getElementById('notification-btn');
    if (panel && btn && !panel.contains(e.target) && !btn.contains(e.target)) {
      panel.classList.add('hidden');
    }
  });
}

function addNotification(message, type = 'info') {
  const notification = {
    id: Date.now(),
    message,
    type,
    timestamp: new Date().toLocaleTimeString('id-ID')
  };

  notifications.unshift(notification);
  if (notifications.length > 50) {
    notifications.pop();
  }

  updateNotificationPanel();

  // Auto-remove after 5 seconds
  setTimeout(() => {
    notifications = notifications.filter(n => n.id !== notification.id);
    updateNotificationPanel();
  }, 5000);
}

function updateNotificationPanel() {
  const list = document.getElementById('notification-list');
  const badge = document.getElementById('notification-badge');

  if (!list) return;

  if (notifications.length === 0) {
    list.innerHTML = '<p class="empty-state">Tidak ada notifikasi</p>';
    badge?.classList.add('hidden');
    return;
  }

  badge?.classList.remove('hidden');
  badge.textContent = notifications.length;

  list.innerHTML = notifications.map(n => `
    <div class="notification-item notification-${n.type}">
      <div class="notification-message">${n.message}</div>
      <div class="notification-time">${n.timestamp}</div>
    </div>
  `).join('');
}

// ============================================================================
// PWA SERVICE WORKER REGISTRATION
// ============================================================================

function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js')
      .then(registration => {
        console.log('✅ Service Worker registered:', registration.scope);
      })
      .catch(error => {
        console.error('❌ Service Worker registration failed:', error);
      });
  }
}

// ============================================================================
// SETTINGS PAGE
// ============================================================================

document.getElementById('btn-change-password')?.addEventListener('click', async () => {
  const newPassword = prompt('Masukkan kata sandi baru:');
  if (!newPassword || newPassword.length < 6) {
    alert('Kata sandi minimal 6 karakter');
    return;
  }

  try {
    await currentUser.updatePassword(newPassword);
    alert('✓ Kata sandi berhasil diubah');
    addNotification('✓ Kata sandi berhasil diubah', 'success');
  } catch (error) {
    alert('✗ Gagal mengubah kata sandi: ' + error.message);
    addNotification('✗ Error: ' + error.message, 'error');
  }
});

document.getElementById('btn-delete-account')?.addEventListener('click', async () => {
  const confirm = window.confirm('Apakah Anda yakin ingin menghapus akun? Tindakan ini tidak dapat dibatalkan!');
  if (!confirm) return;

  try {
    await currentUser.delete();
    alert('✓ Akun berhasil dihapus');
    currentUser = null;
  } catch (error) {
    alert('✗ Gagal menghapus akun: ' + error.message);
  }
});

// Initial setup
console.log('✅ MICROWAT app.js loaded');
