// ============================================================================
// MICROWAT - Notification System (with Floating Toasts)
// ============================================================================

function addNotification(message, type = 'info') {
  // 1. Show high-visibility floating toast notification directly on viewport
  showFloatingToast(message, type);

  // 2. Add to header notification panel list
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
        list.innerHTML = '<p class="text-on-surface-variant text-body-md text-center py-lg">No notifications</p>';
      }
    }, 8000);
  }

  console.log(`[${type.toUpperCase()}] ${message}`);
}

function showFloatingToast(message, type = 'info') {
  let container = document.getElementById('floating-toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'floating-toast-container';
    container.className = 'fixed bottom-6 right-6 z-[99999] flex flex-col gap-sm max-w-sm pointer-events-none';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  const styles = {
    success: 'bg-surface-container-high/95 text-tertiary border border-tertiary/40 shadow-xl',
    error:   'bg-surface-container-high/95 text-error border border-error/40 shadow-xl',
    warning: 'bg-surface-container-high/95 text-yellow-400 border border-yellow-500/40 shadow-xl',
    info:    'bg-surface-container-high/95 text-primary border border-primary/40 shadow-xl'
  };
  const iconMap = {
    success: 'check_circle',
    error: 'error',
    warning: 'warning',
    info: 'info'
  };

  toast.className = `pointer-events-auto flex items-center gap-sm px-md py-sm rounded-xl backdrop-blur-md transition-all transform duration-300 translate-y-3 opacity-0 ${styles[type] || styles.info}`;
  toast.innerHTML = `
    <span class="material-symbols-outlined text-[20px] shrink-0">${iconMap[type] || 'info'}</span>
    <span class="font-bold flex-1 text-[13px] leading-tight">${message}</span>
    <button type="button" class="opacity-60 hover:opacity-100 ml-1 text-on-surface p-0.5 rounded transition-opacity">
      <span class="material-symbols-outlined text-[16px]">close</span>
    </button>
  `;

  const closeBtn = toast.querySelector('button');
  if (closeBtn) {
    closeBtn.onclick = () => {
      toast.classList.add('opacity-0', 'translate-y-2');
      setTimeout(() => toast.remove(), 250);
    };
  }

  container.appendChild(toast);

  // Trigger smooth entrance
  requestAnimationFrame(() => {
    toast.classList.remove('translate-y-3', 'opacity-0');
  });

  // Auto dismiss
  setTimeout(() => {
    if (toast.parentNode) {
      toast.classList.add('opacity-0', 'translate-y-2');
      setTimeout(() => toast.remove(), 250);
    }
  }, 4500);
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
