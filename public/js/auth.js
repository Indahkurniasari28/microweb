// ============================================================================
// MICROWAT - Authentication
// ============================================================================

function setupAuthFormListeners() {
  // Toggle between auth sections
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

  // Password visibility toggle
  document.getElementById('toggle-login-pw')?.addEventListener('click', () => {
    const input = document.getElementById('login-password');
    const icon = document.querySelector('#toggle-login-pw .material-symbols-outlined');
    if (input && icon) {
      if (input.type === 'password') {
        input.type = 'text';
        icon.textContent = 'visibility_off';
      } else {
        input.type = 'password';
        icon.textContent = 'visibility';
      }
    }
  });

  // Login
  document.getElementById('login-form')?.addEventListener('submit', async e => {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    const btn = e.target.querySelector('button[type="submit"]');
    if (btn) btn.disabled = true;

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
    } finally {
      if (btn) btn.disabled = false;
    }
  });

  // Register
  document.getElementById('register-form')?.addEventListener('submit', async e => {
    e.preventDefault();
    const email = document.getElementById('register-email').value;
    const password = document.getElementById('register-password').value;
    const confirm = document.getElementById('register-confirm').value;

    if (password !== confirm) { showAuthError('register', 'Kata sandi tidak cocok'); return; }
    if (password.length < 6) { showAuthError('register', 'Kata sandi minimal 6 karakter'); return; }

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

  // Logout buttons
  document.getElementById('logout-btn')?.addEventListener('click', logout);
}

function toggleAuthSection(sectionId) {
  document.querySelectorAll('.auth-section').forEach(s => s.classList.add('hidden'));
  document.getElementById(sectionId)?.classList.remove('hidden');
}

function showAuthError(section, message) {
  const el = document.getElementById(`${section}-error`);
  if (el) {
    el.textContent = '❌ ' + message;
    el.classList.remove('hidden');
  }
}

function clearAuthForms() {
  document.querySelectorAll('#auth-container input').forEach(i => i.value = '');
  document.querySelectorAll('#auth-container .error-message, [id$="-error"]').forEach(e => e.classList.add('hidden'));
}

function checkAuthState() {
  const user = safeStorage.getItem('user');
  if (user) {
    try {
      currentUser = JSON.parse(user);
      updateUserDisplay(currentUser.email);
      showMainApp();
      loadSystemParameters();
    } catch (err) {
      logout();
    }
  } else {
    showAuthContainer();
  }
}

function logout() {
  safeStorage.removeItem('user');
  currentUser = null;
  currentUserRole = 'user';
  measurementHistory = [];
  try {
    const c1 = document.getElementById('monitoring-chart');
    if (c1 && Chart && Chart.getChart) {
      const ch = Chart.getChart(c1);
      if (ch) ch.destroy();
    }
  } catch (e) {}
  try {
    const c2 = document.getElementById('dashboard-chart');
    if (c2 && Chart && Chart.getChart) {
      const ch2 = Chart.getChart(c2);
      if (ch2) ch2.destroy();
    }
  } catch (e) {}
  chartInstance = null;
  dashboardChartInstance = null;
  showAuthContainer();
  clearAuthForms();
}

function showAuthContainer() {
  document.getElementById('auth-container').classList.remove('hidden');
  document.getElementById('main-app').classList.add('hidden');
  toggleAuthSection('login-section');
}

function showMainApp() {
  document.getElementById('auth-container').classList.add('hidden');
  document.getElementById('main-app').classList.remove('hidden');
  updateUserDisplay(currentUser?.email || '');
  const role = (currentUser?.email || '').toLowerCase().includes('admin') ? 'admin' : 'user';
  updateSidebarForRole(role);
  navigateToPage('dashboard');
}

function updateUserDisplay(email) {
  const emailEl = document.getElementById('user-email-display');
  if (emailEl) emailEl.textContent = email;
  // Settings page email (may or may not be loaded)
  const settingsEl = document.getElementById('settings-email');
  if (settingsEl) settingsEl.textContent = email;
  const profileEl = document.getElementById('profile-display-name');
  if (profileEl) profileEl.textContent = email;
  const profileInput = document.getElementById('profile-email-input');
  if (profileInput) profileInput.value = email;
}
