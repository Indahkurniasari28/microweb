// ============================================================================
// MICROWAT - Analytics Page
// ============================================================================

function initAnalyticsPage() {
  console.log('🔧 Init Analytics');

  // Control buttons
  document.getElementById('btn-control-start')?.addEventListener('click', () => {
    if (socket?.connected) socket.emit('startMeasurement');
    else addNotification('⚠️ WebSocket tidak terhubung', 'warning');
  });

  document.getElementById('btn-control-stop')?.addEventListener('click', () => {
    if (socket?.connected) socket.emit('stopMeasurement');
    else addNotification('⚠️ WebSocket tidak terhubung', 'warning');
  });

  document.getElementById('btn-control-reset')?.addEventListener('click', () => {
    if (socket?.connected) {
      socket.emit('resetMeasurement');
      measurementHistory = [];
      renderHistoryTable();
    }
  });

  document.getElementById('btn-filter-history')?.addEventListener('click', renderHistoryTable);
  document.getElementById('btn-export-csv')?.addEventListener('click', exportHistoryCSV);

  initializeMonitoringChart();
  renderHistoryTable();

  // Populate session summary
  if (measurementHistory.length > 0) {
    const latest = measurementHistory[0];
    const oldest = measurementHistory[measurementHistory.length - 1];
    const a0El = document.getElementById('analytics-a0');
    if (a0El) a0El.textContent = (oldest.absorbance || 0).toFixed(3);
    const afEl = document.getElementById('analytics-af');
    if (afEl) afEl.textContent = (latest.absorbance || 0).toFixed(3);
    const degEl = document.getElementById('analytics-degradation');
    if (degEl) degEl.textContent = (latest.degradation || 0).toFixed(1) + '%';
    const barEl = document.getElementById('analytics-degradation-bar');
    if (barEl) barEl.style.width = (latest.degradation || 0) + '%';
  }

  // Update rpi status
  updateRpiStatus();
}

function updateRpiStatus() {
  const dot = document.getElementById('rpi-status-dot');
  const text = document.getElementById('rpi-status-text');
  if (socket?.connected) {
    if (dot) { dot.className = 'w-2 h-2 rounded-full bg-tertiary'; }
    if (text) { text.textContent = 'ONLINE'; text.className = 'text-xs font-bold text-tertiary'; }
  } else {
    if (dot) { dot.className = 'w-2 h-2 rounded-full bg-outline'; }
    if (text) { text.textContent = 'OFFLINE'; text.className = 'text-xs font-bold text-on-surface-variant'; }
  }
}

function initializeMonitoringChart() {
  const ctx = document.getElementById('monitoring-chart');
  if (!ctx) return;

  if (chartInstance) {
    chartInstance.destroy();
    chartInstance = null;
  }

  chartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: [],
      datasets: [
        {
          label: 'Konsentrasi (ppm)',
          data: [],
          borderColor: '#ff6b6b',
          backgroundColor: 'rgba(255, 107, 107, 0.1)',
          yAxisID: 'y',
          tension: 0.3,
          fill: true
        },
        {
          label: 'Degradasi (%)',
          data: [],
          borderColor: '#7dd3fc',
          backgroundColor: 'rgba(125, 211, 252, 0.05)',
          yAxisID: 'y1',
          tension: 0.3,
          fill: false
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
          display: true,
          position: 'left',
          ticks: { color: '#ff6b6b', font: { family: 'Space Mono', size: 10 } },
          grid: { color: 'rgba(74, 96, 112, 0.2)' },
          title: { display: true, text: 'Konsentrasi (ppm)', color: '#ff6b6b', font: { size: 10 } }
        },
        y1: {
          type: 'linear',
          display: true,
          position: 'right',
          ticks: { color: '#7dd3fc', font: { family: 'Space Mono', size: 10 } },
          grid: { drawOnChartArea: false },
          title: { display: true, text: 'Degradasi (%)', color: '#7dd3fc', font: { size: 10 } }
        }
      }
    }
  });

  updateCharts();
}

function updateCharts() {
  if (chartInstance) {
    const recent = measurementHistory.slice(-20).reverse();
    chartInstance.data.labels = recent.map((_, i) => `${i + 1}`);
    chartInstance.data.datasets[0].data = recent.map(m => m.concentration || 0);
    chartInstance.data.datasets[1].data = recent.map(m => m.degradation || 0);
    chartInstance.update();
  }
  if (dashboardChartInstance) {
    updateDashboardChart();
  }
}

function renderHistoryTable() {
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

  if (filtered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="px-lg py-lg text-center text-on-surface-variant font-body-md">Tidak ada data</td></tr>';
    return;
  }

  tbody.innerHTML = filtered.slice(0, 100).map(m => {
    const deg = (m.degradation || 0).toFixed(1);
    const degColor = parseFloat(deg) >= 80 ? 'text-tertiary' : parseFloat(deg) >= 40 ? 'text-primary' : 'text-on-surface-variant';
    return `
      <tr class="hover:bg-surface-container-highest/20 transition-colors">
        <td class="px-lg py-md font-data-md text-on-surface text-[12px]">${new Date(m.timestamp).toLocaleString('id-ID')}</td>
        <td class="px-lg py-md font-data-md text-primary text-[12px]">${(m.absorbance || 0).toFixed(3)}</td>
        <td class="px-lg py-md font-data-md text-on-surface text-[12px]">${(m.concentration || 0).toFixed(2)}</td>
        <td class="px-lg py-md font-data-md ${degColor} text-[12px]">${deg}%</td>
        <td class="px-lg py-md">
          <span class="px-xs py-xs bg-tertiary-container/10 border border-tertiary-container/30 text-tertiary rounded text-[10px] font-bold">${m.status || 'Auto'}</span>
        </td>
      </tr>
    `;
  }).join('');
}
