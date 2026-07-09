// ============================================================================
// MICROWAT - Main Application Bootstrap
// ============================================================================

window.addEventListener('DOMContentLoaded', initializeApp);

function initializeApp() {
  console.log('🚀 MICROWAT Initialization...');

  setupThemeToggle();
  setupHelpModal();
  initializeSocket();
  setupAuthFormListeners();
  setupPageNavigation();
  setupNotificationPanel();
  checkAuthState();
  registerServiceWorker();

  console.log('✅ MICROWAT Ready');
}

function setupHelpModal() {
  // Help button now navigates to the Info page
  const openBtn = document.getElementById('help-btn');
  if (openBtn) {
    openBtn.addEventListener('click', e => {
      e.preventDefault();
      navigateToPage('info');
    });
  }
}

function setupThemeToggle() {
  const saved = safeStorage.getItem('theme') || 'dark';
  applyTheme(saved);

  document.getElementById('theme-toggle')?.addEventListener('click', () => {
    const isDark = document.documentElement.classList.contains('dark');
    applyTheme(isDark ? 'light' : 'dark');
  });
}

function applyTheme(theme) {
  const html = document.documentElement;
  const icon = document.getElementById('theme-icon');

  if (theme === 'dark') {
    html.classList.add('dark');
    if (icon) icon.textContent = 'light_mode';
  } else {
    html.classList.remove('dark');
    if (icon) icon.textContent = 'dark_mode';
  }

  safeStorage.setItem('theme', theme);
}

function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js')
      .then(() => console.log('✅ Service Worker registered'))
      .catch(err => console.error('❌ Service Worker failed:', err));
  }
}

console.log('✅ app.js loaded');
