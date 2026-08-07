// ============================================================================
// MICROWAT - Dashboard Page
// ============================================================================

function initDashboardPage() {
  console.log('🔧 Init Dashboard');

  // Wire up control buttons
  document.getElementById('btn-start-measurement')?.addEventListener('click', () => {
    if (socket?.connected) socket.emit('startMeasurement');
    else addNotification('⚠️ WebSocket tidak terhubung', 'warning');
  });

  document.getElementById('btn-stop-measurement')?.addEventListener('click', () => {
    if (socket?.connected) socket.emit('stopMeasurement');
    else addNotification('⚠️ WebSocket tidak terhubung', 'warning');
  });

  document.getElementById('btn-reset-data')?.addEventListener('click', () => {
    if (socket?.connected) {
      socket.emit('resetMeasurement');
      measurementHistory = [];
      renderDashboardHistory();
    }
  });

  document.getElementById('btn-simulator')?.addEventListener('click', () => {
    navigateToPage('device-status');
  });

  document.getElementById('btn-export-csv-dash')?.addEventListener('click', exportHistoryCSV);

  // Init dashboard chart
  initDashboardChart();

  // Render with current data
  if (measurementHistory.length > 0) {
    updateMeasurementDisplay(measurementHistory[0]);
  }
  renderDashboardHistory();
}

function initDashboardChart() {
  const ctx = document.getElementById('dashboard-chart');
  if (!ctx) return;
  if (dashboardChartInstance) {
    dashboardChartInstance.destroy();
    dashboardChartInstance = null;
  }

  dashboardChartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: [],
      datasets: [
        {
          label: 'Absorbansi',
          data: [],
          borderColor: '#7dd3fc',
          backgroundColor: 'rgba(125, 211, 252, 0.1)',
          tension: 0.4,
          fill: true
        },
        {
          label: 'Degradasi (%)',
          data: [],
          borderColor: '#c8a0f0',
          backgroundColor: 'rgba(200, 160, 240, 0.1)',
          tension: 0.4,
          fill: false,
          yAxisID: 'y1'
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          labels: { color: '#a0b4c4', font: { family: 'Space Mono', size: 11 } }
        }
      },
      scales: {
        x: {
          ticks: { color: '#4a6070', font: { family: 'Space Mono', size: 10 } },
          grid: { color: 'rgba(74, 96, 112, 0.2)' }
        },
        y: {
          type: 'linear',
          position: 'left',
          ticks: { color: '#7dd3fc', font: { family: 'Space Mono', size: 10 } },
          grid: { color: 'rgba(74, 96, 112, 0.2)' },
          title: { display: true, text: 'Absorbansi', color: '#7dd3fc', font: { size: 10 } }
        },
        y1: {
          type: 'linear',
          position: 'right',
          ticks: { color: '#c8a0f0', font: { family: 'Space Mono', size: 10 } },
          grid: { drawOnChartArea: false },
          title: { display: true, text: 'Degradasi %', color: '#c8a0f0', font: { size: 10 } }
        }
      }
    }
  });

  updateDashboardChart();
}

function updateDashboardChart() {
  if (!dashboardChartInstance) return;
  const recent = measurementHistory.slice(-20).reverse();
  dashboardChartInstance.data.labels = recent.map((_, i) => `${i + 1}`);
  dashboardChartInstance.data.datasets[0].data = recent.map(m => m.absorbance || 0);
  dashboardChartInstance.data.datasets[1].data = recent.map(m => m.degradation || 0);
  dashboardChartInstance.update();
}

function renderDashboardHistory() {
  const tbody = document.getElementById('dashboard-history-body');
  if (!tbody) return;

  if (measurementHistory.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="px-lg py-lg text-center text-on-surface-variant font-body-md">Tidak ada data</td></tr>';
    return;
  }

  tbody.innerHTML = measurementHistory.slice(0, 10).map(m => `
    <tr class="hover:bg-surface-container-high/50 transition-colors">
      <td class="px-lg py-md font-data-md text-on-surface text-[12px]">${new Date(m.timestamp).toLocaleString('id-ID')}</td>
      <td class="px-lg py-md font-data-md text-primary text-[12px]">${(m.absorbance || 0).toFixed(3)}</td>
      <td class="px-lg py-md font-data-md text-on-surface text-[12px]">${(m.concentration || 0).toFixed(2)}</td>
      <td class="px-lg py-md font-data-md text-tertiary text-[12px]">${(m.degradation || 0).toFixed(1)}%</td>
      <td class="px-lg py-md text-[12px]">
        <span class="px-xs py-xs bg-tertiary/10 border border-tertiary/30 text-tertiary rounded text-[10px] font-bold">
          ${m.status || 'Auto'}
        </span>
      </td>
    </tr>
  `).join('');
}

function updateMeasurementDisplay(measurement) {
  if (!measurement) return;

  const absorbance = measurement.absorbance || 0;
  const concentration = measurement.concentration || 0;
  const degradation = measurement.degradation || 0;

  // Update value displays (may or may not exist depending on current page)
  const absEl = document.getElementById('absorbance-value');
  if (absEl) absEl.textContent = absorbance.toFixed(3);

  const concEl = document.getElementById('concentration-value');
  if (concEl) concEl.textContent = concentration.toFixed(2);

  const degEl = document.getElementById('degradation-value');
  if (degEl) degEl.textContent = degradation.toFixed(1) + '%';

  // Progress bar
  const progress = document.getElementById('degradation-progress');
  if (progress) progress.style.width = degradation + '%';

  // Dashboard-specific bar
  const bar = document.getElementById('degradation-bar');
  if (bar) bar.style.width = degradation + '%';

  // Progress circle (SVG)
  const circle = document.getElementById('degradation-circle');
  if (circle) {
    const circumference = 2 * Math.PI * 24;
    const offset = circumference - (degradation / 100) * circumference;
    circle.style.strokeDashoffset = offset;
  }

  // Pct label
  const pctLabel = document.getElementById('degradation-pct-label');
  if (pctLabel) pctLabel.textContent = `${degradation.toFixed(0)}% COMPLETE`;

  // Timestamp
  if (measurement.timestamp) {
    const time = new Date(measurement.timestamp).toLocaleTimeString('id-ID');
    const tsEl = document.getElementById('measure-timestamp');
    if (tsEl) tsEl.textContent = time;
    const lastEl = document.getElementById('last-update-time');
    if (lastEl) lastEl.textContent = time;
    const analyticsEl = document.getElementById('analytics-last-update');
    if (analyticsEl) analyticsEl.textContent = time;
  }

  // Status badge
  let statusText = '■ IDLE';
  let statusClass = 'bg-surface-container-highest border border-outline-variant text-on-surface-variant';
  if (degradation >= 90) {
    statusText = '✓ SELESAI';
    statusClass = 'bg-tertiary/10 border border-tertiary text-tertiary';
  } else if (degradation >= 50) {
    statusText = '⟳ BERLANGSUNG';
    statusClass = 'bg-primary/10 border border-primary text-primary';
  } else if (degradation > 0) {
    statusText = '▶ DIMULAI';
    statusClass = 'bg-yellow-500/10 border border-yellow-500/30 text-yellow-400';
  }

  const badge = document.getElementById('status-badge');
  if (badge) {
    badge.textContent = statusText;
    badge.className = `inline-flex items-center gap-xs px-sm py-xs rounded-lg font-label-caps text-label-caps w-fit ${statusClass}`;
  }

  // Analytics page
  const analyticsA0 = document.getElementById('analytics-a0');
  const analyticsAf = document.getElementById('analytics-af');
  const analyticsDeg = document.getElementById('analytics-degradation');
  const analyticsBar = document.getElementById('analytics-degradation-bar');
  if (analyticsAf) analyticsAf.textContent = absorbance.toFixed(3);
  if (analyticsDeg) analyticsDeg.textContent = degradation.toFixed(1) + '%';
  if (analyticsBar) analyticsBar.style.width = degradation + '%';

  // Device status page
  const devConc = document.getElementById('device-concentration');
  if (devConc) devConc.textContent = concentration.toFixed(2);
  const devDeg = document.getElementById('device-degradation');
  if (devDeg) devDeg.textContent = degradation.toFixed(1);
  const specAbs = document.getElementById('spec-absorbance');
  if (specAbs) specAbs.textContent = absorbance.toFixed(3) + ' a.u.';

  updateSystemStatus('hardware', 'online');
  updateDashboardChart();
}

function addMeasurementToHistory(measurement) {
  measurementHistory.unshift(measurement);
  if (measurementHistory.length > 500) measurementHistory.pop();
}

function updateMeasurementStatus(status) {
  const statuses = {
    measuring: '⏸️ MEASURING',
    stopped:   '⏹️ STOPPED',
    idle:      '⏸️ IDLE'
  };
  const el = document.getElementById('measurement-status');
  if (el) el.textContent = statuses[status] || status;
}
