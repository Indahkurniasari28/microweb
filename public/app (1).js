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
  const modal = document.getElementById('help-modal');
  const openBtn = document.getElementById('help-btn');
  const closeBtn = document.getElementById('help-close');
  if (!modal || !openBtn) return;

  // Build TOC from sections
  const TOC_ITEMS = [
    { id: 'help-intro',     icon: 'info',                 label: 'Pengenalan' },
    { id: 'help-auth',      icon: 'login',                label: 'Login & Akun' },
    { id: 'help-dashboard', icon: 'dashboard',            label: 'Dashboard' },
    { id: 'help-analytics', icon: 'query_stats',          label: 'Analytics' },
    { id: 'help-device',    icon: 'science',              label: 'Device Status' },
    { id: 'help-history',   icon: 'database',             label: 'Data History' },
    { id: 'help-settings',  icon: 'settings',             label: 'Settings' },
    { id: 'help-admin',     icon: 'admin_panel_settings', label: 'Fitur Admin' },
    { id: 'help-tips',      icon: 'tips_and_updates',     label: 'Tips & Navigasi' },
  ];

  const toc = document.getElementById('help-toc');
  if (toc) {
    toc.innerHTML = TOC_ITEMS.map(item => `
      <button data-target="${item.id}" class="help-toc-btn flex items-center gap-sm px-lg py-sm text-left text-on-surface-variant hover:text-primary hover:bg-primary/5 transition-all w-full text-body-md">
        <span class="material-symbols-outlined text-[18px] shrink-0">${item.icon}</span>
        <span>${item.label}</span>
      </button>
    `).join('');

    toc.querySelectorAll('.help-toc-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const target = document.getElementById(btn.dataset.target);
        if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        setActiveTocItem(btn.dataset.target);
      });
    });
  }

  // Scroll spy
  const content = document.getElementById('help-content');
  if (content) {
    content.addEventListener('scroll', () => {
      let active = TOC_ITEMS[0].id;
      TOC_ITEMS.forEach(item => {
        const el = document.getElementById(item.id);
        if (el && el.offsetTop - content.scrollTop - 80 <= 0) active = item.id;
      });
      setActiveTocItem(active);
    });
  }

  function setActiveTocItem(id) {
    document.querySelectorAll('.help-toc-btn').forEach(b => {
      const isActive = b.dataset.target === id;
      b.classList.toggle('text-primary', isActive);
      b.classList.toggle('bg-primary/10', isActive);
      b.classList.toggle('font-bold', isActive);
      b.classList.toggle('text-on-surface-variant', !isActive);
    });
  }

  // Open
  openBtn.addEventListener('click', () => {
    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    // Reset to top
    if (content) content.scrollTop = 0;
    setActiveTocItem('help-intro');
  });

  // Close
  const doClose = () => {
    modal.classList.add('hidden');
    document.body.style.overflow = '';
  };
  closeBtn?.addEventListener('click', doClose);
  modal.addEventListener('click', e => { if (e.target === modal) doClose(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !modal.classList.contains('hidden')) doClose(); });
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
