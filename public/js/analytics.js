// ============================================================================
// MICROWAT - Analytics Page
// ============================================================================

(function () {
  // Dibungkus IIFE supaya kalau script ini ke-load 2x (misal ke-include
  // dobel di HTML/layout), gak throw "Identifier already declared" yang
  // bikin SELURUH file berhenti eksekusi (ini penyebab paling umum grafik
  // analytics gak pernah muncul padahal dashboard normal).

  const ANALYTICS_CYCLE_COLORS = {
    0:  '#515151',
    15: '#B177DE',
    30: '#CC9900',
    45: '#00CBCC',
    60: '#7D4E4E'
  };

  const ANALYTICS_TIME_POINTS = [0, 15, 30, 45, 60];
  let currentAnalyticsPhase = 0;

  const ANALYTICS_WASTE_LABELS = { rc: 'Congo Red', mg: 'Malachite Green', mb: 'Methylene Blue' };
  const ANALYTICS_WASTE_COLORS = {
    rc: { text: '#f87171', bg: 'rgba(248,113,113,0.1)', border: 'rgba(248,113,113,0.4)' },
    mg: { text: '#34d399', bg: 'rgba(52,211,153,0.1)',  border: 'rgba(52,211,153,0.4)' },
    mb: { text: '#60a5fa', bg: 'rgba(96,165,250,0.1)',  border: 'rgba(96,165,250,0.4)' }
  };

  function getAnalyticsFiltered() {
    const dateVal = document.getElementById('history-date-from')?.value || '';
    const sessionVal = document.getElementById('analytics-session-filter')?.value || 'all';
    let filtered = measurementHistory;
    if (dateVal) filtered = filtered.filter(m => new Date(m.timestamp).toISOString().split('T')[0] === dateVal);
    if (sessionVal !== 'all') filtered = filtered.filter(m => String(m.session || 1) === sessionVal);
    return filtered;
  }

  function addSpectralPointToMonitoringChart(wavelength, absorbance, reactionTimeMin) {
    if (!chartInstance) return;
    const tp    = reactionTimeMin ?? 0;
    const dsIdx = ANALYTICS_TIME_POINTS.indexOf(tp);
    if (dsIdx < 0) return;

    chartInstance.data.datasets[dsIdx].data.push({ x: wavelength, y: absorbance });
    chartInstance.update('none');

    if (dsIdx > currentAnalyticsPhase) {
      currentAnalyticsPhase = dsIdx;
      updateAnalyticsPhaseUI();
    }
  }

  function updateAnalyticsPhaseUI() {
    const tp = ANALYTICS_TIME_POINTS[currentAnalyticsPhase];
    const phaseText = document.getElementById('analytics-phase-text');
    if (phaseText) phaseText.textContent = `Fase ${currentAnalyticsPhase + 1}/5 · ${tp} menit`;

    const dotsContainer = document.getElementById('analytics-phase-dots');
    if (dotsContainer) {
      const dots = dotsContainer.querySelectorAll('span');
      ANALYTICS_TIME_POINTS.forEach((t, i) => {
        if (dots[i]) dots[i].style.opacity = i <= currentAnalyticsPhase ? '1' : '0.2';
      });
    }
  }

  function initAnalyticsPage() {
    console.log('🔧 Init Analytics');

    const banner = document.getElementById('sim-mode-banner');
    if (banner) banner.classList.toggle('hidden', !window.simMode);

    document.getElementById('btn-filter-history')?.addEventListener('click', () => {
      populateAnalyticsSessionFilter();
      renderHistoryTable();
      resetAnalyticsChart();
    });

    document.getElementById('btn-export-csv')?.addEventListener('click', exportHistoryCSV);

    document.getElementById('history-date-from')?.addEventListener('change', populateAnalyticsSessionFilter);

    document.querySelectorAll('.analytics-wt-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.analytics-wt-btn').forEach(b => {
          const wt = b.dataset.wt;
          const c = ANALYTICS_WASTE_COLORS[wt];
          b.style.background = 'transparent';
          b.style.borderColor = c.border.replace('0.4', '0.3');
        });
        const wt = btn.dataset.wt;
        const c = ANALYTICS_WASTE_COLORS[wt];
        btn.style.background = c.bg;
        btn.style.borderColor = c.text;
        currentWastewaterType = wt;
        if (typeof subscribeDashboardToWastewaterType === 'function') {
          subscribeDashboardToWastewaterType(wt);
        }
      });
    });

    // PENTING: chart harus dibuat DULU sebelum subscribe ke Firestore,
    // supaya pas data cycle pertama masuk, chartInstance & canvas udah siap.
    initializeMonitoringChart();

    if (typeof subscribeDashboardToWastewaterType === 'function') {
      subscribeDashboardToWastewaterType(currentWastewaterType || 'rc');
    } else {
      console.error('❌ subscribeDashboardToWastewaterType tidak ditemukan — pastikan dashboard.js dimuat SEBELUM analytics.js');
    }

    populateAnalyticsSessionFilter();
    renderHistoryTable();

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
  }

  function populateAnalyticsSessionFilter() {
    const dateVal = document.getElementById('history-date-from')?.value || '';
    const sel = document.getElementById('analytics-session-filter');
    if (!sel) return;

    const sessions = [];
    if (dateVal) {
      const dayData = measurementHistory.filter(m => {
        return new Date(m.timestamp).toISOString().split('T')[0] === dateVal;
      });
      const sessionSet = new Set(dayData.map(m => m.session || 1));
      sessionSet.forEach(s => sessions.push(s));
      sessions.sort((a, b) => a - b);
    }

    sel.innerHTML = '<option value="all">All Session</option>';
    sessions.forEach(s => {
      sel.innerHTML += `<option value="${s}">Session ${s}</option>`;
    });
  }

  function initializeMonitoringChart() {
    const ctx = document.getElementById('monitoring-chart');
    if (!ctx) {
      console.error('❌ Canvas #monitoring-chart tidak ditemukan di DOM saat initializeMonitoringChart dipanggil. Cek apakah HTML analytics.html sudah ke-render sebelum script jalan.');
      return;
    }

    currentAnalyticsPhase = 0;

    if (chartInstance) {
      try { chartInstance.destroy(); } catch (e) {}
      chartInstance = null;
    }
    console.debug('analytics: initializing monitoring chart, canvas found:', !!ctx);

    // Kalau ada Chart lama nempel di canvas ini (dari render sebelumnya), adopt aja
    try {
      const existing = Chart.getChart ? Chart.getChart(ctx) : null;
      if (existing) {
        console.debug('analytics: adopting existing Chart instance id=', existing.id);
        chartInstance = existing;
        updateAnalyticsPhaseUI();
        return;
      }
    } catch (e) {
      console.debug('analytics: error checking existing Chart:', e && e.message);
    }

    const datasets = ANALYTICS_TIME_POINTS.map(tp => ({
      label: `${tp} min`,
      data: [],
      borderColor: ANALYTICS_CYCLE_COLORS[tp],
      backgroundColor: 'transparent',
      borderWidth: tp === 0 ? 2 : 1.5,
      pointRadius: 0,
      pointHoverRadius: 4,
      tension: 0.1,
      fill: false,
      spanGaps: false,
      parsing: false
    }));

    chartInstance = new Chart(ctx, {
      type: 'line',
      data: { datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: {
            display: false,
            labels: { color: '#a0b4c4', font: { family: 'Poppins', size: 11 } }
          },
          tooltip: {
            callbacks: {
              title: items => `λ = ${items[0].parsed.x} nm`,
              label: item => {
                const y = item.raw?.y;
                return y != null ? ` ${item.dataset.label}: ${Number(y).toFixed(4)} a.u.` : null;
              }
            }
          }
        },
        scales: {
          x: {
            type: 'linear',
            min: 140,
            max: 1340,
            ticks: { color: '#4a6070', font: { family: 'Poppins', size: 10 }, stepSize: 100 },
            grid: { color: 'rgba(74, 96, 112, 0.2)' },
            title: { display: true, text: 'Panjang Gelombang (nm)', color: '#a0b4c4', font: { size: 11, family: 'Poppins' } }
          },
          y: {
            ticks: { color: '#7dd3fc', font: { family: 'Poppins', size: 10 } },
            grid: { color: 'rgba(74, 96, 112, 0.2)' },
            title: { display: true, text: 'Absorbansi (a.u.)', color: '#7dd3fc', font: { size: 11, family: 'Poppins' } }
          }
        }
      }
    });

    console.debug('analytics: chartInstance created?', !!chartInstance);
    updateAnalyticsPhaseUI();
  }

  function resetAnalyticsChart() {
    currentAnalyticsPhase = 0;
    if (!chartInstance) { initializeMonitoringChart(); return; }
    ANALYTICS_TIME_POINTS.forEach((tp, i) => {
      if (chartInstance.data.datasets[i]) chartInstance.data.datasets[i].data = [];
    });
    chartInstance.update('none');
    updateAnalyticsPhaseUI();
  }

  function renderAnalyticsChartFromCycles(cycles) {
    if (!chartInstance) initializeMonitoringChart();
    const canvas = document.getElementById('monitoring-chart');
    const activeChart = chartInstance || (Chart.getChart ? Chart.getChart(canvas) : null);
    if (!activeChart) {
      console.error('❌ renderAnalyticsChartFromCycles: tidak ada chart aktif, data cycle diabaikan.');
      return;
    }
    currentAnalyticsPhase = 0;
    ANALYTICS_TIME_POINTS.forEach((tp, i) => {
      if (activeChart.data.datasets[i]) activeChart.data.datasets[i].data = [];
    });

    let maxPhase = -1;
    console.debug('analytics: rendering from cycles', cycles && cycles.length);
    cycles.forEach(rawCycle => {
      const cycle = typeof normalizeCycleRecord === 'function'
        ? normalizeCycleRecord(rawCycle, rawCycle && rawCycle.id)
        : (rawCycle || {});

      const idx = Number.isInteger(cycle.cycle) ? cycle.cycle : ANALYTICS_TIME_POINTS.indexOf(Number(cycle.elapsedMinutes));
      const dsIdx = Number.isFinite(idx) ? Number(idx) : -1;
      if (dsIdx < 0 || dsIdx >= ANALYTICS_TIME_POINTS.length) return;

      const points = (Array.isArray(cycle.wavelengths) && Array.isArray(cycle.absorbanceValues)
        ? cycle.wavelengths.map((wl, i) => ({ x: Number(wl), y: Number(cycle.absorbanceValues[i]) }))
        : []
      ).filter(p => Number.isFinite(p.x) && Number.isFinite(p.y));

      if (points.length) {
        activeChart.data.datasets[dsIdx].data = points;
        if (dsIdx > maxPhase) maxPhase = dsIdx;
      }
    });

    if (maxPhase >= 0) currentAnalyticsPhase = maxPhase;
    try { activeChart.update('none'); } catch (e) { console.debug('analytics: chart update failed', e && e.message); }
    updateAnalyticsPhaseUI();
  }

  function updateCharts() {
    // Tidak dipakai lagi
  }

  function renderHistoryTable() {
    const tbody = document.getElementById('history-table-body');
    if (!tbody) return;

    const fromDate = document.getElementById('history-date-from')?.value || '';
    const sessionVal = document.getElementById('analytics-session-filter')?.value || 'all';

    let filtered = measurementHistory;
    if (fromDate) {
      filtered = filtered.filter(m => new Date(m.timestamp).toISOString().split('T')[0] === fromDate);
    }
    if (sessionVal !== 'all') {
      filtered = filtered.filter(m => String(m.session || 1) === sessionVal);
    }

    if (filtered.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" class="px-lg py-lg text-center text-on-surface-variant font-body-md">Tidak ada data</td></tr>';
      return;
    }

    tbody.innerHTML = filtered.slice(0, 100).map(m => {
      const deg = (m.degradation || 0).toFixed(1);
      const isSafe = (m.concentration || 0) <= 5;
      const wt = m.wastewaterType || 'mb';
      const wtLabel = ANALYTICS_WASTE_LABELS[wt] || wt.toUpperCase();
      const wtC = ANALYTICS_WASTE_COLORS[wt] || ANALYTICS_WASTE_COLORS.mb;
      const session = m.session || 1;

      return `
        <tr class="hover:bg-surface-container-highest/20 transition-colors">
          <td class="px-lg py-md font-data-md text-on-surface text-[12px]">${new Date(m.timestamp).toLocaleString('id-ID')}</td>
          <td class="px-lg py-md text-[12px]">
            <span class="px-xs py-[2px] bg-primary/10 border border-primary/30 text-primary rounded text-[10px] font-bold">Session ${session}</span>
          </td>
          <td class="px-lg py-md text-[12px]">
            <span class="px-xs py-[2px] rounded text-[10px] font-bold border" style="color:${wtC.text}; background:${wtC.bg}; border-color:${wtC.border}">${wtLabel}</span>
          </td>
          <td class="px-lg py-md font-data-md text-on-surface text-[12px]">${(m.concentration || 0).toFixed(2)}</td>
          <td class="px-lg py-md font-data-md text-[12px] ${isSafe ? 'text-green-400' : 'text-red-400'}">${deg}%</td>
          <td class="px-lg py-md">
            <span class="px-xs py-[2px] rounded text-[10px] font-bold border ${isSafe ? 'bg-green-500/10 border-green-500/30 text-green-400' : 'bg-red-500/10 border-red-500/30 text-red-400'}">
              ${isSafe ? 'SAFE' : 'NOT SAFE'}
            </span>
          </td>
        </tr>`;
    }).join('');
  }

  // Expose ke global scope karena dipanggil dari navigation.js, dashboard.js,
  // atau lewat inline onclick di HTML.
  window.initAnalyticsPage = initAnalyticsPage;
  window.getAnalyticsFiltered = getAnalyticsFiltered;
  window.addSpectralPointToMonitoringChart = addSpectralPointToMonitoringChart;
  window.updateAnalyticsPhaseUI = updateAnalyticsPhaseUI;
  window.populateAnalyticsSessionFilter = populateAnalyticsSessionFilter;
  window.initializeMonitoringChart = initializeMonitoringChart;
  window.resetAnalyticsChart = resetAnalyticsChart;
  window.renderAnalyticsChartFromCycles = renderAnalyticsChartFromCycles;
  window.updateCharts = updateCharts;
  window.renderHistoryTable = renderHistoryTable;

})();