// ============================================================================
// MICROWAT - Notification System
// ============================================================================

function addNotification(message, type = 'info') {
  const list = document.getElementById('notification-list');
  if (!list) {
    console.log(`[${type.toUpperCase()}] ${message}`);
    return;
  }

  // Remove empty state message
  const empty = list.querySelector('p');
  if (empty && empty.textContent.includes('Tidak ada')) empty.remove();

  const timestamp = new Date().toLocaleTimeString('id-ID');

  const colorMap = {
    success: 'border-tertiary/30 bg-tertiary/5 text-tertiary',
    error:   'border-error/30 bg-error/5 text-error',
    warning: 'border-yellow-500/30 bg-yellow-500/5 text-yellow-400',
    info:    'border-primary/30 bg-primary/5 text-primary'
  };
  const iconMap = {
    success: 'check_circle',
    error: 'error',
    warning: 'warning',
    info: 'info'
  };

  const item = document.createElement('div');
  item.className = `flex items-start gap-sm p-sm border rounded-lg ${colorMap[type] || colorMap.info}`;
  item.innerHTML = `
    <span class="material-symbols-outlined text-[16px] mt-xs shrink-0">${iconMap[type] || 'info'}</span>
    <div class="min-w-0 flex-1">
      <p class="text-[12px] font-body-md break-words">${message}</p>
      <p class="text-[10px] opacity-70 mt-xs">${timestamp}</p>
    </div>
  `;
  list.insertBefore(item, list.firstChild);

  while (list.children.length > 50) list.removeChild(list.lastChild);

  const badge = document.getElementById('notification-badge');
  if (badge) {
    badge.classList.remove('hidden');
  }

  if (type !== 'error') {
    setTimeout(() => {
      if (item.parentNode) item.parentNode.removeChild(item);
      if (list.children.length === 0) {
        list.innerHTML = '<p class="text-on-surface-variant text-body-md text-center py-lg">Tidak ada notifikasi</p>';
      }
    }, 5000);
  }

  console.log(`[${type.toUpperCase()}] ${message}`);
}

function setupNotificationPanel() {
  const btn = document.getElementById('notification-btn');
  const panel = document.getElementById('notification-panel');
  const closeBtn = document.getElementById('close-notification-panel');

  if (btn && panel) {
    btn.addEventListener('click', () => {
      panel.classList.toggle('hidden');
      // Clear badge when opening
      const badge = document.getElementById('notification-badge');
      if (badge && !panel.classList.contains('hidden')) {
        badge.classList.add('hidden');
      }
    });
  }

  if (closeBtn && panel) {
    closeBtn.addEventListener('click', () => panel.classList.add('hidden'));
  }

  // Close on outside click
  document.addEventListener('click', (e) => {
    if (panel && !panel.classList.contains('hidden')) {
      if (!panel.contains(e.target) && !btn?.contains(e.target)) {
        panel.classList.add('hidden');
      }
    }
  });
}
