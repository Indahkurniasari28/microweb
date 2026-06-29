// ============================================================================
// MICROWAT - Main Application JS (Simplified Auth)
// ============================================================================

let currentUser = null;
let socket = null;
let measurementHistory = [];

// Initialize on DOM load
window.addEventListener('DOMContentLoaded', initializeApp);

/**
 * Main initialization
 */
function initializeApp() {
  console.log('🚀 Initializing MICROWAT...');

  // Setup Socket.io
  initializeSocket();

  // Setup event listeners
  setupAuthFormListeners();
  setupPageNavigation();
  setupControlButtons();

  // Check if user already logged in
  checkAuthState();

  // Register service worker
  registerServiceWorker();

  console.log('✅ App ready');
}

// ============================================================================
// SOCKET.IO
// ============================================================================

function initializeSocket() {
  if (typeof io === 'undefined') {
    console.error('❌ Socket.io not loaded');
    return;
  }

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
    console.log('📊 Data received:', data);
    updateMeasurementDisplay(data);
    addMeasurementToHistory(data);
  });

  socket.on('statusUpdate', data => {
    updateSystemStatus('hardware', data.status === 'online' ? 'online' : 'offline');
  });
}

// ============================================================================
// AUTHENTICATION
// ============================================================================

function setupAuthFormListeners() {
  // Link handlers
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

  // Login form
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
      if (response.ok) {
        localStorage.setItem('user', JSON.stringify(data.user));
        currentUser = data.user;
        clearAuthForms();
        showMainApp();
        console.log('✅ Login success:', email);
      } else {
        showAuthError('login', data.message || 'Login gagal');
      }
    } catch (error) {
      showAuthError('login', error.message);
      console.error('❌ Login error:', error);
    }
  });

  // Register form
  document.getElementById('register-form')?.addEventListener('submit', async e => {
    e.preventDefault();
    const email = document.getElementById('register-email').value;
    const password = document.getElementById('register-password').value;
    const confirm = document.getElementById('register-confirm').value;

    if (password !== confirm) {
      showAuthError('register', 'Kata sandi tidak cocok');
      return;
    }

    try {
      const response = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      const data = await response.json();
      if (response.ok) {
        alert('✅ Akun berhasil dibuat! Silakan login.');
        toggleAuthSection('login-section');
      } else {
        showAuthError('register', data.message || 'Registrasi gagal');
      }
    } catch (error) {
      showAuthError('register', error.message);
      console.error('❌ Register error:', error);
    }
  });

  // Reset form
  document.getElementById('reset-form')?.addEventListener('submit', async e => {
    e.preventDefault();
    const email = document.getElementById('reset-email').value;

    try {
      const response = await fetch('/api/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });

      if (response.ok) {
        alert('✅ Email reset telah dikirim');
        toggleAuthSection('login-section');
      } else {
        showAuthError('reset', 'Gagal mengirim email reset');
      }
    } catch (error) {
      showAuthError('reset', error.message);
    }
  });

  // Logout button
  document.getElementById('logout-btn')?.addEventListener('click', logout);
  document.getElementById('btn-logout-settings')?.addEventListener('click', logout);
}

function toggleAuthSection(sectionId) {
  document.querySelectorAll('.auth-section').forEach(section => {
    section.classList.add('hidden');
  });
  const section = document.getElementById(sectionId);
  if (section) section.classList.remove('hidden');
}

function showAuthError(section, message) {
  const errorEl = document.getElementById(`${section}-error`);
  if (errorEl) {
    errorEl.textContent = '❌ ' + message;
    errorEl.classList.remove('hidden');
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
  const user = localStorage.getItem('user');
  if (user) {
    try {
      currentUser = JSON.parse(user);
      updateUserDisplay(currentUser.email);
      showMainApp();
      console.log('✅ User session restored:', currentUser.email);
    } catch (error) {
      console.error('❌ Invalid session:', error);
      logout();
    }
  } else {
    showAuthContainer();
  }
}

function logout() {
  localStorage.removeItem('user');
  currentUser = null;
  showAuthContainer();
  clearAuthForms();
  console.log('✅ Logged out');
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
  const els = [
    document.getElementById('user-email-display'),
    document.getElementById('settings-email')
  ];
  els.forEach(el => {
    if (el) el.textContent = email;
  });
}

// ============================================================================
// NAVIGATION
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
  // Update nav
  document.querySelectorAll('.nav-link').forEach(link => {
    link.classList.toggle('active', link.dataset.page === pageName);
  });

  // Update pages
  document.querySelectorAll('.page').forEach(page => {
    page.classList.add('hidden');
  });
  const page = document.getElementById(`${pageName}-page`);
  if (page) page.classList.remove('hidden');

  // Update title
  const titles = {
    dashboard: 'Dashboard',
    monitoring: 'Monitoring',
    history: 'Riwayat Data',
    controls: 'Kontrol Sistem',
    settings: 'Pengaturan'
  };
  const titleEl = document.getElementById('page-title');
  if (titleEl) titleEl.textContent = titles[pageName] || 'MICROWAT';

  console.log('📄 Navigate to:', pageName);
}

// ============================================================================
// MEASUREMENTS
// ============================================================================

function updateMeasurementDisplay(measurement) {
  if (!measurement) return;

  document.getElementById('absorbance-value').textContent = 
    (measurement.absorbance || 0).toFixed(3);
  
  document.getElementById('concentration-value').textContent = 
    (measurement.concentration || 0).toFixed(2);
  
  document.getElementById('degradation-value').textContent = 
    (measurement.degradation || 0).toFixed(1) + '%';

  const progress = document.getElementById('degradation-progress');
  if (progress) {
    progress.style.width = (measurement.degradation || 0) + '%';
  }

  if (measurement.timestamp) {
    const time = new Date(measurement.timestamp).toLocaleTimeString('id-ID');
    const el = document.getElementById('measure-timestamp');
    if (el) el.textContent = time;
    
    const lastEl = document.getElementById('last-update-time');
    if (lastEl) lastEl.textContent = time;
  }

  updateSystemStatus('hardware', measurement.status === 'online' ? 'online' : 'offline');
}

function addMeasurementToHistory(measurement) {
  measurementHistory.push(measurement);
  if (measurementHistory.length > 1000) {
    measurementHistory.shift();
  }
  updateHistoryTable();
}

function updateHistoryTable() {
  const tbody = document.getElementById('history-table-body');
  if (!tbody) return;

  if (measurementHistory.length === 0) {
    tbody.innerHTML = '<tr><td colspan="3" class="empty-state">Tidak ada data</td></tr>';
    return;
  }

  tbody.innerHTML = measurementHistory.map(m => `
    <tr>
      <td>${new Date(m.timestamp).toLocaleString('id-ID')}</td>
      <td>${(m.concentration || 0).toFixed(2)} mg/L</td>
      <td>${(m.degradation || 0).toFixed(1)}%</td>
    </tr>
  `).join('');
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

// ============================================================================
// CONTROLS
// ============================================================================

function setupControlButtons() {
  document.getElementById('btn-start-measurement')?.addEventListener('click', () => {
    if (socket?.connected) {
      socket.emit('publish', { topic: 'microwat/control/start', message: '1' });
      console.log('📤 Start command sent');
    }
  });

  document.getElementById('btn-stop-measurement')?.addEventListener('click', () => {
    if (socket?.connected) {
      socket.emit('publish', { topic: 'microwat/control/stop', message: '0' });
      console.log('📤 Stop command sent');
    }
  });

  document.getElementById('btn-reset-data')?.addEventListener('click', () => {
    measurementHistory = [];
    updateHistoryTable();
    console.log('✅ Data reset');
  });
}

// ============================================================================
// NOTIFICATIONS
// ============================================================================

function addNotification(message) {
  console.log('🔔', message);
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
