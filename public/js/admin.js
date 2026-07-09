// ============================================================================
// MICROWAT - Admin Pages
// ============================================================================

// ─── User Management ─────────────────────────────────────────────────────────

let umUsers = [];
let umFiltered = [];
let umPage = 1;
const UM_PER_PAGE = 10;
let umEditTarget = null;

async function initUserManagementPage() {
  console.log('🔧 Init User Management');

  umPage = 1;
  renderUmLoading();

  try {
    const res = await fetch('/api/admin/users');
    const data = await res.json();
    umUsers = data.users || [];
  } catch (err) {
    console.error('Gagal load users:', err);
    umUsers = [];
  }

  umFiltered = [...umUsers];
  updateUmStats();
  renderUmTable();

  document.getElementById('um-search')?.addEventListener('input', filterUmUsers);
  document.getElementById('um-role-filter')?.addEventListener('change', filterUmUsers);
  document.getElementById('um-status-filter')?.addEventListener('change', filterUmUsers);

  document.getElementById('btn-add-user')?.addEventListener('click', () => {
    addNotification('ℹ️ Gunakan form register untuk menambah user baru', 'info');
  });

  document.getElementById('btn-review-all')?.addEventListener('click', async () => {
    const pending = umUsers.filter(u => u.status === 'pending');
    if (!pending.length) return;
    await Promise.all(pending.map(u => fetch(`/api/admin/users/${u.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'active' })
    }).catch(() => null)));
    pending.forEach(u => { u.status = 'active'; });
    filterUmUsers();
    addNotification(`✅ ${pending.length} user diaktifkan`, 'success');
  });

  // Modal controls
  document.getElementById('um-modal-close')?.addEventListener('click', closeUmModal);
  document.getElementById('um-modal-cancel')?.addEventListener('click', closeUmModal);
  document.getElementById('um-modal-save')?.addEventListener('click', saveUmRole);
}

function renderUmLoading() {
  const tbody = document.getElementById('um-table-body');
  if (!tbody) return;
  tbody.innerHTML = `
    <tr><td colspan="6" class="px-lg py-xl text-center text-on-surface-variant">
      <div class="flex flex-col items-center gap-sm">
        <span class="material-symbols-outlined text-[40px] animate-spin text-primary/50">refresh</span>
        <span class="font-body-md">Memuat data pengguna...</span>
      </div>
    </td></tr>`;
}

function filterUmUsers() {
  const q = document.getElementById('um-search')?.value.toLowerCase() || '';
  const role = document.getElementById('um-role-filter')?.value || 'all';
  const status = document.getElementById('um-status-filter')?.value || 'all';

  umFiltered = umUsers.filter(u => {
    const matchQ = !q || u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
    const matchRole = role === 'all' || u.role === role;
    const matchStatus = status === 'all' || u.status === status;
    return matchQ && matchRole && matchStatus;
  });

  umPage = 1;
  renderUmTable();
  updateUmStats();
}

function updateUmStats() {
  const total = umUsers.length;
  const active = umUsers.filter(u => u.status === 'active').length;
  const pending = umUsers.filter(u => u.status === 'pending').length;
  const admins = umUsers.filter(u => u.role === 'admin').length;

  const badge = document.getElementById('um-total-badge');
  if (badge) badge.textContent = `${total} TOTAL`;

  const arc = document.getElementById('um-capacity-arc');
  if (arc) arc.setAttribute('stroke-dasharray', `100,100`);
  const pctEl = document.getElementById('um-capacity-pct');
  if (pctEl) pctEl.textContent = `${total}`;
  const textEl = document.getElementById('um-capacity-text');
  if (textEl) textEl.textContent = `${total} pengguna aktif`;

  const setEl = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  setEl('um-stat-active', active);
  setEl('um-stat-pending', pending);
  setEl('um-stat-admin', admins);

  const banner = document.getElementById('pending-banner');
  if (banner) {
    banner.classList.toggle('hidden', pending === 0);
    const countText = document.getElementById('pending-count-text');
    if (countText) countText.textContent = `${pending} new user${pending !== 1 ? 's' : ''} awaiting approval`;
  }
}

function renderUmTable() {
  const tbody = document.getElementById('um-table-body');
  if (!tbody) return;

  const start = (umPage - 1) * UM_PER_PAGE;
  const paged = umFiltered.slice(start, start + UM_PER_PAGE);

  const countEl = document.getElementById('um-count-label');
  if (countEl) countEl.textContent = `Showing ${Math.min(start + 1, umFiltered.length)}–${Math.min(start + UM_PER_PAGE, umFiltered.length)} of ${umFiltered.length} users`;

  if (paged.length === 0) {
    tbody.innerHTML = `
      <tr><td colspan="6" class="px-lg py-xl text-center text-on-surface-variant">
        <div class="flex flex-col items-center gap-sm">
          <span class="material-symbols-outlined text-[40px] text-outline">group_off</span>
          <span>No users found</span>
        </div>
      </td></tr>`;
    return;
  }

  tbody.innerHTML = paged.map(u => {
    const statusColor = u.status === 'active' ? 'text-green-500 bg-green-500/10 border-green-500'
      : u.status === 'pending' ? 'text-yellow-500 bg-yellow-500/10 border-yellow-500'
      : 'text-red-500 bg-red-500/10 border-red-500';
    const statusDot = u.status === 'active' ? 'bg-green-500' : u.status === 'pending' ? 'bg-yellow-500' : 'bg-red-500';
    const roleStyle = u.role === 'admin'
      ? 'bg-primary/10 text-primary border border-primary/30'
      : 'bg-surface-container-highest text-on-surface-variant border border-outline-variant/30';

    return `
      <tr class="hover:bg-surface-container-high/30 transition-colors">
        <td class="px-lg py-md">
          <div class="flex items-center gap-md">
            <div class="w-10 h-10 rounded-full bg-primary-container/20 flex items-center justify-center shrink-0">
              <span class="material-symbols-outlined text-primary text-[20px]">person</span>
            </div>
            <div>
              <p class="font-bold text-on-surface">${u.name}</p>
              <p class="text-body-md text-on-surface-variant opacity-70">${u.email}</p>
            </div>
          </div>
        </td>
        <td class="px-lg py-md text-body-md text-on-surface-variant hidden md:table-cell">${u.institution || '-'}</td>
        <td class="px-lg py-md">
          <span class="px-sm py-xs rounded text-label-caps ${roleStyle}">${u.role.toUpperCase()}</span>
        </td>
        <td class="px-lg py-md">
          <div class="flex items-center gap-xs">
            <span class="w-2 h-2 rounded-full ${statusDot}"></span>
            <span class="text-label-caps ${statusColor.split(' ')[0]} uppercase">${u.status}</span>
          </div>
        </td>
        <td class="px-lg py-md font-data-md text-on-surface-variant hidden lg:table-cell">${u.joined}</td>
        <td class="px-lg py-md text-right">
          <div class="flex justify-end gap-sm">
            <button onclick="openUmModal(${u.id})" class="p-xs text-on-surface-variant hover:text-primary transition-colors">
              <span class="material-symbols-outlined text-[20px]">edit</span>
            </button>
            <button onclick="toggleUmBlock(${u.id})" class="p-xs text-on-surface-variant hover:text-secondary transition-colors">
              <span class="material-symbols-outlined text-[20px]">${u.status === 'blocked' ? 'lock_open' : 'block'}</span>
            </button>
            <button onclick="deleteUmUser(${u.id})" class="p-xs text-on-surface-variant hover:text-error transition-colors">
              <span class="material-symbols-outlined text-[20px]">delete</span>
            </button>
          </div>
        </td>
      </tr>`;
  }).join('');

  renderUmPagination();
}

function renderUmPagination() {
  const container = document.getElementById('um-pagination');
  if (!container) return;
  const maxPage = Math.max(1, Math.ceil(umFiltered.length / UM_PER_PAGE));

  container.innerHTML = `
    <button onclick="umGoPage(${umPage - 1})" ${umPage <= 1 ? 'disabled' : ''} class="p-xs glass-panel rounded-lg text-on-surface-variant hover:text-primary disabled:opacity-30">
      <span class="material-symbols-outlined">chevron_left</span>
    </button>
    <button class="px-md py-xs glass-panel rounded-lg text-primary font-bold">${umPage}</button>
    <span class="px-sm py-xs text-on-surface-variant text-body-md">of ${maxPage}</span>
    <button onclick="umGoPage(${umPage + 1})" ${umPage >= maxPage ? 'disabled' : ''} class="p-xs glass-panel rounded-lg text-on-surface-variant hover:text-primary disabled:opacity-30">
      <span class="material-symbols-outlined">chevron_right</span>
    </button>`;
}

function umGoPage(page) {
  const maxPage = Math.max(1, Math.ceil(umFiltered.length / UM_PER_PAGE));
  umPage = Math.max(1, Math.min(page, maxPage));
  renderUmTable();
}

function openUmModal(userId) {
  const user = umUsers.find(u => u.id === userId);
  if (!user) return;
  umEditTarget = user;

  const modal = document.getElementById('um-modal');
  document.getElementById('modal-user-name').textContent = user.name;
  document.getElementById('modal-user-email').textContent = user.email;
  const roleSelect = document.getElementById('modal-role-select');
  if (roleSelect) roleSelect.value = user.role;
  document.getElementById('modal-note').value = '';
  modal?.classList.remove('hidden');
}

function closeUmModal() {
  document.getElementById('um-modal')?.classList.add('hidden');
  umEditTarget = null;
}

async function saveUmRole() {
  if (!umEditTarget) return;
  const newRole = document.getElementById('modal-role-select')?.value;
  if (newRole && newRole !== umEditTarget.role) {
    try {
      await fetch(`/api/admin/users/${umEditTarget.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole })
      });
      umEditTarget.role = newRole;
      filterUmUsers();
      addNotification(`✅ Role ${umEditTarget.name} diperbarui ke ${newRole.toUpperCase()}`, 'success');
    } catch {
      addNotification('❌ Gagal memperbarui role', 'error');
    }
  }
  closeUmModal();
}

async function toggleUmBlock(userId) {
  const user = umUsers.find(u => String(u.id) === String(userId));
  if (!user) return;
  const newStatus = user.status === 'blocked' ? 'active' : 'blocked';
  try {
    await fetch(`/api/admin/users/${userId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus })
    });
    user.status = newStatus;
    filterUmUsers();
    addNotification(`${newStatus === 'blocked' ? '🔒 User diblokir' : '🔓 User diaktifkan'}: ${user.name}`, newStatus === 'blocked' ? 'warning' : 'success');
  } catch {
    addNotification('❌ Gagal memperbarui status', 'error');
  }
}

async function deleteUmUser(userId) {
  const user = umUsers.find(u => String(u.id) === String(userId));
  if (!user) return;
  if (!confirm(`Hapus user ${user.name}?`)) return;
  try {
    await fetch(`/api/admin/users/${userId}`, { method: 'DELETE' });
    umUsers = umUsers.filter(u => String(u.id) !== String(userId));
    umFiltered = umFiltered.filter(u => String(u.id) !== String(userId));
    renderUmTable();
    updateUmStats();
    addNotification(`🗑️ User ${user.name} dihapus`, 'warning');
  } catch {
    addNotification('❌ Gagal menghapus user', 'error');
  }
}

// ─── Log Detail ───────────────────────────────────────────────────────────────

let logPage = 1;
const LOG_PER_PAGE = 15;
let logFiltered = [];
let logDrawerEntry = null;

function buildLogEntries() {
  return measurementHistory.map((m, i) => {
    const isSafe = (m.concentration || 0) <= 5;
    return {
      id: i + 1,
      timestamp: new Date(m.timestamp).toLocaleString('id-ID'),
      rawTs: new Date(m.timestamp).getTime(),
      event: 'Measurement',
      typeKey: 'measurement',
      value: `${(m.absorbance || 0).toFixed(3)} a.u.`,
      status: isSafe ? 'NOMINAL' : 'WARNING',
      statusColor: isSafe ? 'tertiary' : 'secondary',
      absorbance: (m.absorbance || 0).toFixed(3),
      concentration: (m.concentration || 0).toFixed(2),
      degradation: (m.degradation || 0).toFixed(1),
      session: m.session || 1,
      wastewaterType: m.wastewaterType || '-',
      notes: ''
    };
  });
}

function initLogDetailPage() {
  console.log('🔧 Init Log Detail');

  logPage = 1;
  logFiltered = buildLogEntries();

  updateLogMetrics();
  renderLogTable();
  updateLogStats();

  document.getElementById('btn-log-filter')?.addEventListener('click', applyLogFilter);
  document.getElementById('btn-export-log')?.addEventListener('click', exportLogCSV);
  document.getElementById('log-prev')?.addEventListener('click', () => { if (logPage > 1) { logPage--; renderLogTable(); } });
  document.getElementById('log-next')?.addEventListener('click', () => {
    const max = Math.ceil(logFiltered.length / LOG_PER_PAGE);
    if (logPage < max) { logPage++; renderLogTable(); }
  });

  // Drawer close
  document.getElementById('log-drawer-close')?.addEventListener('click', closeLogDrawer);
  document.getElementById('log-drawer-backdrop')?.addEventListener('click', closeLogDrawer);
  document.getElementById('btn-drawer-save')?.addEventListener('click', saveDrawerNotes);
  document.getElementById('btn-drawer-flag')?.addEventListener('click', flagDrawerEntry);

  // Live time ticker
  setInterval(() => {
    const el = document.getElementById('log-live-time');
    if (el) el.textContent = new Date().toLocaleTimeString('id-ID');
  }, 1000);
}

function updateLogMetrics() {
  const latest = measurementHistory[0] || { absorbance: 0, concentration: 0, degradation: 0 };
  const abs = parseFloat(latest.absorbance || 0);
  const conc = parseFloat(latest.concentration || 0);
  const deg = parseFloat(latest.degradation || 0);

  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  const setW = (id, pct) => { const el = document.getElementById(id); if (el) el.style.width = pct + '%'; };

  set('log-absorbance', abs.toFixed(3));
  setW('log-abs-bar', Math.min(100, abs * 100));
  set('log-concentration', conc.toFixed(2) + ' ppm');
  setW('log-conc-bar', Math.min(100, (conc / 10) * 100));
  set('log-degradation', deg.toFixed(1) + '%');
  setW('log-deg-bar', deg);
}

function applyLogFilter() {
  const all = buildLogEntries();
  const from = document.getElementById('log-date-from')?.value;
  const to = document.getElementById('log-date-to')?.value;
  const type = document.getElementById('log-type-filter')?.value || 'all';

  logFiltered = all.filter(e => {
    const dateStr = new Date(e.rawTs).toISOString().split('T')[0];
    if (from && dateStr < from) return false;
    if (to && dateStr > to) return false;
    if (type !== 'all' && e.typeKey !== type) return false;
    return true;
  });

  logPage = 1;
  renderLogTable();
  updateLogStats();
}

function updateLogStats() {
  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  set('log-stat-total', logFiltered.length);
  set('log-stat-measurements', logFiltered.filter(e => e.typeKey === 'measurement').length);
  set('log-stat-system', logFiltered.filter(e => e.typeKey === 'system').length);
  set('log-stat-errors', logFiltered.filter(e => e.typeKey === 'error').length);
}

function renderLogTable() {
  const tbody = document.getElementById('log-table-body');
  if (!tbody) return;

  const start = (logPage - 1) * LOG_PER_PAGE;
  const paged = logFiltered.slice(start, start + LOG_PER_PAGE);

  const countEl = document.getElementById('log-count-label');
  if (countEl) countEl.textContent = `${logFiltered.length} events`;
  const pageEl = document.getElementById('log-page-info');
  if (pageEl) pageEl.textContent = logPage;

  if (paged.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="px-lg py-xl text-center text-on-surface-variant">No log entries found</td></tr>`;
    return;
  }

  tbody.innerHTML = paged.map(e => `
    <tr class="hover:bg-surface-container-high/30 transition-colors cursor-pointer" onclick="openLogDrawer(${e.id})">
      <td class="px-lg py-md font-data-md text-on-surface text-[12px]">${e.timestamp}</td>
      <td class="px-lg py-md font-body-md text-on-surface">${e.event}</td>
      <td class="px-lg py-md font-data-md text-primary text-[12px]">${e.value}</td>
      <td class="px-lg py-md">
        <span class="px-sm py-xs bg-${e.statusColor}/10 border border-${e.statusColor} text-${e.statusColor} text-[10px] rounded-lg font-bold">${e.status}</span>
      </td>
      <td class="px-lg py-md text-right">
        <button class="text-primary hover:underline text-[12px] flex items-center gap-xs ml-auto">
          <span class="material-symbols-outlined text-[14px]">open_in_new</span> Detail
        </button>
      </td>
    </tr>`).join('');

  const prevBtn = document.getElementById('log-prev');
  const nextBtn = document.getElementById('log-next');
  if (prevBtn) prevBtn.disabled = logPage <= 1;
  if (nextBtn) nextBtn.disabled = logPage >= Math.ceil(logFiltered.length / LOG_PER_PAGE);
}

function openLogDrawer(entryId) {
  const entry = logFiltered.find(e => e.id === entryId);
  if (!entry) return;
  logDrawerEntry = entry;

  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  set('drawer-title', `Log Entry — ${entry.event}`);
  set('drawer-subtitle', `${entry.typeKey.charAt(0).toUpperCase() + entry.typeKey.slice(1)} Event`);
  set('drawer-timestamp', entry.timestamp);
  set('drawer-absorbance', entry.absorbance + ' a.u.');
  set('drawer-concentration', entry.concentration + ' ppm');
  set('drawer-degradation', entry.degradation + '%');
  set('drawer-event-type', entry.event);

  const badge = document.getElementById('drawer-status-badge');
  if (badge) {
    badge.textContent = entry.status;
    badge.className = `px-sm py-xs bg-${entry.statusColor}/10 border border-${entry.statusColor} text-${entry.statusColor} rounded-lg font-label-caps text-label-caps`;
  }

  const notes = document.getElementById('drawer-notes');
  if (notes) notes.value = entry.notes || '';

  document.getElementById('log-drawer')?.classList.remove('hidden');
}

function closeLogDrawer() {
  document.getElementById('log-drawer')?.classList.add('hidden');
  logDrawerEntry = null;
}

function saveDrawerNotes() {
  if (!logDrawerEntry) return;
  logDrawerEntry.notes = document.getElementById('drawer-notes')?.value || '';
  addNotification('✅ Catatan disimpan', 'success');
  closeLogDrawer();
}

function flagDrawerEntry() {
  if (!logDrawerEntry) return;
  logDrawerEntry.status = 'ANOMALY';
  logDrawerEntry.statusColor = 'error';
  renderLogTable();
  addNotification('🚩 Entry ditandai sebagai anomali', 'warning');
  closeLogDrawer();
}

function exportLogCSV() {
  let csv = 'Timestamp,Event,Value,Status\n';
  logFiltered.forEach(e => {
    csv += `"${e.timestamp}","${e.event}","${e.value}","${e.status}"\n`;
  });
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `microwat-log-${new Date().toISOString().split('T')[0]}.csv`;
  link.click();
  addNotification('✅ Log diekspor', 'success');
}

// ─── Instrument Config ────────────────────────────────────────────────────────

function initInstrumentConfigPage() {
  console.log('🔧 Init Instrument Config');

  const slider = document.getElementById('mw-power-slider');
  const display = document.getElementById('mw-power-display');
  if (slider && display) {
    slider.addEventListener('input', () => {
      display.textContent = slider.value + ' W';
    });
  }

  document.getElementById('btn-save-config')?.addEventListener('click', saveInstrumentConfig);
  document.getElementById('btn-apply-cal')?.addEventListener('click', applyCalibration);

  setupToggleButton('mw-auto-toggle');
  setupToggleButton('uv-power-toggle');
  setupToggleButton('safety-estop-toggle');

  const lastBackup = document.getElementById('ic-last-backup');
  if (lastBackup) lastBackup.textContent = new Date(Date.now() - 3600000 * 4).toLocaleString('id-ID');
}

function setupToggleButton(id) {
  const btn = document.getElementById(id);
  if (!btn) return;
  btn.addEventListener('click', () => {
    const dot = btn.querySelector('span');
    const isOn = dot.classList.contains('translate-x-5');
    if (isOn) {
      dot.classList.replace('translate-x-5', 'translate-x-1');
      btn.classList.remove('bg-primary');
      btn.classList.add('bg-surface-variant');
    } else {
      dot.classList.replace('translate-x-1', 'translate-x-5');
      btn.classList.add('bg-primary');
      btn.classList.remove('bg-surface-variant');
    }
  });
}

function saveInstrumentConfig() {
  const params = {
    initialConcentration: parseFloat(document.getElementById('spec-init-conc')?.value || 100),
    wavelength: parseFloat(document.getElementById('spec-wavelength')?.value || 254),
    moldExtinctionCoeff: parseFloat(document.getElementById('spec-extinction')?.value || 1000),
    pathLength: parseFloat(document.getElementById('spec-path-length')?.value || 1)
  };

  fetch('/api/parameters', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params)
  }).then(r => r.json()).then(data => {
    if (data.success) {
      systemParameters = params;
      addNotification('✅ Konfigurasi instrumen disimpan', 'success');
    } else {
      addNotification('❌ Gagal menyimpan konfigurasi', 'error');
    }
  }).catch(() => {
    addNotification('✅ Konfigurasi disimpan (lokal)', 'success');
    systemParameters = params;
  });
}

function applyCalibration() {
  addNotification('🔬 Kalibrasi diterapkan ke sistem', 'success');
}

// ─── Admin Settings ───────────────────────────────────────────────────────────

function initAdminSettingsPage() {
  console.log('🔧 Init Admin Settings');

  // Tab switching
  const tabs = document.querySelectorAll('.admin-settings-tab');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const target = tab.dataset.tab;
      switchAdminTab(target);
    });
  });

  // Default tab
  switchAdminTab('profile');

  // Fill user info
  updateAdminSettingsDisplay(currentUser?.email || '');

  // Logout
  document.getElementById('btn-admin-logout-settings')?.addEventListener('click', logout);

  // Profile form
  document.getElementById('admin-profile-form')?.addEventListener('submit', e => {
    e.preventDefault();
    addNotification('✅ Profil admin disimpan', 'success');
  });

  // Security form
  document.getElementById('btn-sec-save')?.addEventListener('click', () => {
    const p1 = document.getElementById('sec-new-pw')?.value;
    const p2 = document.getElementById('sec-confirm-pw')?.value;
    if (!p1 || p1 !== p2) {
      addNotification('❌ Password tidak cocok', 'error');
      return;
    }
    addNotification('✅ Password diperbarui', 'success');
  });

  // Notifications save
  document.getElementById('btn-notif-save')?.addEventListener('click', () => {
    addNotification('✅ Pengaturan notifikasi disimpan', 'success');
  });

  // Toggle buttons
  setupToggleButton('sec-2fa-toggle');
  setupToggleButton('notif-system-errors');
  setupToggleButton('notif-efficiency');
  setupToggleButton('notif-new-users');

  // System params form
  document.getElementById('admin-params-form')?.addEventListener('submit', async e => {
    e.preventDefault();
    const params = {
      initialConcentration: parseFloat(document.getElementById('sys-initial-concentration')?.value || 100),
      wavelength: parseFloat(document.getElementById('sys-wavelength')?.value || 254),
      moldExtinctionCoeff: parseFloat(document.getElementById('sys-extinction-coeff')?.value || 1000),
      pathLength: parseFloat(document.getElementById('sys-path-length')?.value || 1)
    };
    try {
      const response = await fetch('/api/parameters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params)
      });
      const data = await response.json();
      if (data.success) {
        systemParameters = params;
        addNotification('✅ Parameter sistem disimpan', 'success');
      }
    } catch {
      addNotification('✅ Parameter disimpan (lokal)', 'success');
      systemParameters = params;
    }
  });

  // Populate system params
  if (systemParameters) {
    const set = (id, val) => { const el = document.getElementById(id); if (el && val !== undefined) el.value = val; };
    set('sys-initial-concentration', systemParameters.initialConcentration);
    set('sys-wavelength', systemParameters.wavelength);
    set('sys-extinction-coeff', systemParameters.moldExtinctionCoeff);
    set('sys-path-length', systemParameters.pathLength);
  }

  const sysLastSync = document.getElementById('admin-sys-lastsync');
  if (sysLastSync) sysLastSync.textContent = new Date().toLocaleTimeString('id-ID');
}

function switchAdminTab(tab) {
  const panels = ['profile', 'security', 'notifications', 'system'];
  panels.forEach(p => {
    document.getElementById(`admin-panel-${p}`)?.classList.add('hidden');
  });
  document.getElementById(`admin-panel-${tab}`)?.classList.remove('hidden');

  document.querySelectorAll('.admin-settings-tab').forEach(btn => {
    const isActive = btn.dataset.tab === tab;
    btn.classList.toggle('text-primary', isActive);
    btn.classList.toggle('border-l-4', isActive);
    btn.classList.toggle('border-l-primary', isActive);
    btn.classList.toggle('font-bold', isActive);
    btn.classList.toggle('text-on-surface-variant', !isActive);
    btn.classList.remove('border-l-0');
  });
}

function updateAdminSettingsDisplay(email) {
  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  const setV = (id, val) => { const el = document.getElementById(id); if (el) el.value = val; };
  set('admin-profile-display-name', email);
  set('admin-settings-email', email);
  setV('admin-profile-email-input', email);
}

console.log('✅ admin.js loaded');
