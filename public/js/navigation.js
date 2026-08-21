// ============================================================================
// MICROWAT - Page Navigation (Dynamic Page Loading)
// ============================================================================

const PAGE_TITLES = {
  dashboard:          'Dashboard',
  analytics:          'Analytics',
  'device-status':    'Device',
  'device-detail':    'Device Detail',
  history:            'History',
  settings:           'Settings',
  info:               'Info',
  'user-management':  'User Management',
  'log-detail':       'Log Detail',
  'instrument-config':'Instrument Config',
  'admin-settings':   'Admin Settings'
};

async function navigateToPage(pageName) {
  // Admin settings redirect for settings nav link
  if (pageName === 'settings' && currentUserRole === 'admin') {
    pageName = 'admin-settings';
  }

  console.log('🔄 Navigating to:', pageName);

  // Simpan halaman aktif agar bisa di-restore setelah refresh
  safeStorage.setItem('lastPage', pageName);

  // Update nav active states
  document.querySelectorAll('.nav-link').forEach(link => {
    const isActive = link.dataset.page === pageName;
    link.classList.toggle('active', isActive);
  });

  // Update mobile bottom nav active state
  updateMobileBottomNav(pageName);

  // Update page title
  const titleEl = document.getElementById('page-title');
  if (titleEl) titleEl.textContent = PAGE_TITLES[pageName] || 'MICROWAT';

  // Load page HTML
  const pageContent = document.getElementById('page-content');
  if (!pageContent) return;

  pageContent.innerHTML = `
    <div class="flex items-center justify-center h-64">
      <div class="flex flex-col items-center gap-md text-on-surface-variant">
        <span class="material-symbols-outlined text-[48px] animate-spin">refresh</span>
        <span class="font-body-md">Memuat halaman...</span>
      </div>
    </div>
  `;

  try {
    const response = await fetch(`/pages/${pageName}.html`);
    if (!response.ok) throw new Error(`Page not found: ${pageName}`);
    const html = await response.text();
    pageContent.innerHTML = html;

    // Call page-specific init
    initPage(pageName);
  } catch (err) {
    console.error('Page load error:', err);
    pageContent.innerHTML = `
      <div class="flex items-center justify-center h-64">
        <div class="flex flex-col items-center gap-md text-error">
          <span class="material-symbols-outlined text-[48px]">error</span>
          <span class="font-body-md">Gagal memuat halaman: ${pageName}</span>
        </div>
      </div>
    `;
  }
}

function initPage(pageName) {
  switch (pageName) {
    case 'dashboard':           initDashboardPage(); break;
    case 'analytics':           initAnalyticsPage(); break;
    case 'device-status':       initDeviceStatusPage(); break;
    case 'device-detail':       initDeviceDetailPage(); break;
    case 'history':             initHistoryPage(); break;
    case 'settings':            initSettingsPage(); break;
    case 'info':                /* static page, no init needed */ break;
    case 'admin-settings':      initAdminSettingsPage(); break;
    case 'user-management':     initUserManagementPage(); break;
    case 'log-detail':          initLogDetailPage(); break;
    case 'instrument-config':   initInstrumentConfigPage(); break;
  }
}

function setupPageNavigation() {
  document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', e => {
      e.preventDefault();
      navigateToPage(link.dataset.page);
    });
  });

  // Mobile drawer nav links
  document.querySelectorAll('.mobile-nav-link').forEach(link => {
    link.addEventListener('click', e => {
      e.preventDefault();
      closeMobileDrawer();
      navigateToPage(link.dataset.page);
    });
  });

  // Mobile bottom nav buttons
  document.querySelectorAll('.mobile-bottom-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      navigateToPage(btn.dataset.page);
    });
  });

  // Mobile menu toggle
  document.getElementById('mobile-menu-btn')?.addEventListener('click', openMobileDrawer);

  // Mobile export / logout
  document.getElementById('mobile-export-btn')?.addEventListener('click', () => { exportHistoryCSV(); closeMobileDrawer(); });
  document.getElementById('mobile-logout-btn')?.addEventListener('click', () => { closeMobileDrawer(); logout(); });

  // Export Data button → trigger CSV export
  document.getElementById('export-data-btn')?.addEventListener('click', () => {
    exportHistoryCSV();
  });
}

function openMobileDrawer() {
  const overlay = document.getElementById('mobile-drawer-overlay');
  const drawer = document.getElementById('mobile-drawer');
  if (!overlay || !drawer) return;
  overlay.classList.remove('hidden');
  drawer.classList.remove('hidden');
  drawer.classList.add('flex');
  // Sync user display
  const mainDisplay = document.getElementById('user-email-display');
  const mobileDisplay = document.getElementById('mobile-user-display');
  if (mainDisplay && mobileDisplay) mobileDisplay.textContent = mainDisplay.textContent;
}

function closeMobileDrawer() {
  const overlay = document.getElementById('mobile-drawer-overlay');
  const drawer = document.getElementById('mobile-drawer');
  if (!overlay || !drawer) return;
  overlay.classList.add('hidden');
  drawer.classList.add('hidden');
  drawer.classList.remove('flex');
}

function updateMobileBottomNav(pageName) {
  document.querySelectorAll('.mobile-bottom-btn').forEach(btn => {
    const isActive = btn.dataset.page === pageName || (pageName === 'device-detail' && btn.dataset.page === 'device-status');
    btn.classList.toggle('text-primary', isActive);
    btn.classList.toggle('font-bold', isActive);
    btn.classList.toggle('text-on-surface-variant', !isActive);
    const icon = btn.querySelector('.material-symbols-outlined');
    if (icon) icon.style.fontVariationSettings = isActive ? "'FILL' 1" : "'FILL' 0";
  });
}
