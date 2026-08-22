// ============================================================================
// MICROWAT - History Page
// ============================================================================

let historyPage = 1;
const HIST_PER_PAGE = 20;
let historyFiltered = [];
let histCurrentFilter = 'all';

const WASTE_TYPE_LABELS = { rc: 'Congo Red', mg: 'Malachite Green', mb: 'Methylene Blue' };
const WASTE_TYPE_COLORS = {
  rc: { text: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/30' },
  mg: { text: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30' },
  mb: { text: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/30' }
};

function initHistoryPage() {
  console.log('🔧 Init History');

  historyPage = 1;
  histCurrentFilter = 'all';
  historyFiltered = [...measurementHistory];

  loadAllExperimentsToHistory();

  document.getElementById('btn-export-csv')?.addEventListener('click', exportHistoryCSV);
  document.getElementById('btn-hist-filter')?.addEventListener('click', applyHistoryFilter);
  document.getElementById('hist-prev')?.addEventListener('click', () => {
    if (historyPage > 1) { historyPage--; renderHistoryCards(); }
  });
  document.getElementById('hist-next')?.addEventListener('click', () => {
    const maxPage = Math.ceil(historyFiltered.length / HIST_PER_PAGE);
    if (historyPage < maxPage) { historyPage++; renderHistoryCards(); }
  });

  ['all', 'rc', 'mg', 'mb'].forEach(f => {
    document.getElementById(`filter-${f}`)?.addEventListener('click', () => {
      histCurrentFilter = f;
      setActiveFilter(f);
      if (f !== 'all' && typeof subscribeDashboardToWastewaterType === 'function') {
        subscribeDashboardToWastewaterType(f);
      }
    });
  });

  document.getElementById('hist-date-from')?.addEventListener('change', populateSessionFilter);

  renderHistoryCards();
}

function populateSessionFilter() {
  const dateVal = document.getElementById('hist-date-from')?.value || '';
  const sel = document.getElementById('hist-session-filter');
  if (!sel) return;

  // Find sessions for this date
  const sessions = [];
  if (dateVal) {
    const dayData = measurementHistory.filter(m => {
      return new Date(m.timestamp).toISOString().split('T')[0] === dateVal;
    });
    const sessionSet = new Set(dayData.map(m => m.session || 1));
    sessionSet.forEach(s => sessions.push(s));
    sessions.sort((a, b) => a - b);
  }

  sel.innerHTML = '<option value="all">Semua Session</option>';
  sessions.forEach(s => {
    sel.innerHTML += `<option value="${s}">Session ${s}</option>`;
  });
}

function setActiveFilter(filter) {
  ['all', 'rc', 'mg', 'mb'].forEach(f => {
    const btn = document.getElementById(`filter-${f}`);
    if (!btn) return;
    if (f === filter) {
      if (f === 'all') {
        btn.className = 'px-lg py-xs font-label-caps text-label-caps bg-primary/20 text-primary border border-primary/50 rounded-[6px] transition-all';
      } else {
        const c = WASTE_TYPE_COLORS[f];
        btn.className = `px-lg py-xs font-label-caps text-label-caps ${c.text} ${c.bg} border ${c.border} rounded-[6px] transition-all`;
      }
    } else {
      btn.className = 'px-lg py-xs font-label-caps text-label-caps text-on-surface-variant/60 hover:text-on-surface-variant hover:bg-surface-container-highest/10 border border-transparent rounded-[6px] transition-all';
    }
  });
  historyPage = 1;
  historyFiltered = buildFilteredHistory();
  renderHistoryCards();
}

function applyHistoryFilter() {
  historyFiltered = buildFilteredHistory();
  historyPage = 1;
  renderHistoryCards();
}

function buildFilteredHistory() {
  const from = document.getElementById('hist-date-from')?.value || '';
  const sessionVal = document.getElementById('hist-session-filter')?.value || 'all';

  return measurementHistory.filter(m => {
    const date = new Date(m.timestamp).toISOString().split('T')[0];
    if (from && date !== from) return false;
    if (sessionVal !== 'all' && String(m.session || 1) !== sessionVal) return false;
    if (histCurrentFilter !== 'all' && (m.wastewaterType || 'mb') !== histCurrentFilter) return false;
    return true;
  });
}

function renderHistoryCards() {
  const tbody = document.getElementById('history-table-body');
  if (!tbody) return;

  const total = historyFiltered.length;
  const start = (historyPage - 1) * HIST_PER_PAGE;
  const paged = historyFiltered.slice(start, start + HIST_PER_PAGE);

  const countEl = document.getElementById('hist-count-label');
  if (countEl) countEl.textContent = total > 0
    ? `Menampilkan ${Math.min(start + 1, total)}–${Math.min(start + HIST_PER_PAGE, total)} dari ${total} record`
    : 'Tidak ada data';

  const pageEl = document.getElementById('hist-page-info');
  if (pageEl) pageEl.textContent = historyPage;

  if (paged.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="px-lg py-lg text-center text-on-surface-variant font-body-md">
          <div class="flex flex-col items-center gap-sm">
            <span class="material-symbols-outlined text-[40px] text-outline">database</span>
            <span>Tidak ada data</span>
          </div>
        </td>
      </tr>`;
    return;
  }

  // Track first-occurrence flag per waste type for coloring
  const seenWasteType = {};

  tbody.innerHTML = paged.map(m => {
    const deg = (m.degradation || 0).toFixed(1);
    const isSafe = (m.concentration || 0) <= 5;
    const wt = m.wastewaterType || 'mb';
    const wtLabel = WASTE_TYPE_LABELS[wt] || wt.toUpperCase();
    const wtColors = WASTE_TYPE_COLORS[wt] || WASTE_TYPE_COLORS.mb;

    // Only color waste type on first occurrence
    const isFirst = !seenWasteType[wt];
    seenWasteType[wt] = true;
    const wtClass = isFirst
      ? `${wtColors.text} ${wtColors.bg} border ${wtColors.border}`
      : 'text-on-surface-variant bg-surface-container/30 border border-outline-variant/30';

    const session = m.session || 1;

    return `
      <tr class="hover:bg-surface-container-high/50 transition-colors">
        <td class="px-lg py-md font-data-md text-on-surface text-[12px]">${new Date(m.timestamp).toLocaleString('id-ID')}</td>
        <td class="px-lg py-md text-[12px]">
          <span class="px-xs py-xs bg-primary/10 border border-primary/30 text-primary rounded text-[10px] font-bold">
            Session ${session}
          </span>
        </td>
        <td class="px-lg py-md text-[12px]">
          <span class="px-xs py-xs rounded text-[10px] font-bold border ${wtClass}">
            ${wtLabel}
          </span>
        </td>
        <td class="px-lg py-md font-data-md text-on-surface text-[12px]">${(m.concentration || 0).toFixed(2)}</td>
        <td class="px-lg py-md font-data-md text-[12px] ${isSafe ? 'text-green-400' : 'text-red-400'}">${deg}%</td>
        <td class="px-lg py-md">
          <span class="px-xs py-xs rounded text-[10px] font-bold ${isSafe ? 'bg-green-500/10 border border-green-500/30 text-green-400' : 'bg-red-500/10 border border-red-500/30 text-red-400'}">
            ${isSafe ? 'SAFE' : 'NOT SAFE'}
          </span>
        </td>
        <td class="px-lg py-md text-right">
          <button class="text-primary hover:underline text-[12px] flex items-center gap-xs ml-auto" onclick="downloadRowCSV('${m.timestamp}')">
            <span class="material-symbols-outlined text-[14px]">download</span> CSV
          </button>
        </td>
      </tr>`;
  }).join('');
}

function downloadRowCSV(timestamp) {
  const m = measurementHistory.find(x => x.timestamp === timestamp);
  if (!m) return;
  const wt = m.wastewaterType || 'mb';
  const csv = `Waktu,Session,Jenis Limbah,Konsentrasi (ppm),Degradasi (%),Status\n"${m.timestamp}",${m.session || 1},${WASTE_TYPE_LABELS[wt] || wt},${m.concentration || 0},${m.degradation || 0},"${(m.concentration || 0) <= 5 ? 'SAFE' : 'NOT SAFE'}"`;
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `microwat-${new Date(m.timestamp).toISOString().split('T')[0]}.csv`;
  link.click();
}

function exportHistoryCSV() {
  const source = buildFilteredHistory ? buildFilteredHistory() : measurementHistory;
  if (!source || source.length === 0) {
    addNotification('⚠️ Tidak ada data untuk diekspor', 'warning');
    return;
  }

  let csv = 'Waktu,Session,Jenis Limbah,Konsentrasi (ppm),Degradasi (%),Status\n';
  source.forEach(m => {
    const wt = m.wastewaterType || 'mb';
    const isSafe = (m.concentration || 0) <= 5;
    csv += `"${m.timestamp}",${m.session || 1},${WASTE_TYPE_LABELS[wt] || wt},${m.concentration || 0},${m.degradation || 0},"${isSafe ? 'SAFE' : 'NOT SAFE'}"\n`;
  });

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `microwat-${new Date().toISOString().split('T')[0]}.csv`;
  link.click();
  addNotification('✅ Data diekspor', 'success');
}

async function loadAllExperimentsToHistory() {
  if (typeof microwatDb === 'undefined' || !microwatDb) return;
  try {
    const experimentsSnap = await microwatDb.collection('experiments').get();
    for (const expDoc of experimentsSnap.docs) {
      const expId = expDoc.id;
      const cyclesSnap = await microwatDb.collection('experiments').doc(expId).collection('cycles').orderBy('cycle').get();
      if (!cyclesSnap.empty) {
        const cycles = cyclesSnap.docs.map(d => normalizeCycleRecord(d.data(), d.id));
        let wt = 'rc';
        if (expId.toLowerCase().includes('mg')) wt = 'mg';
        else if (expId.toLowerCase().includes('mb')) wt = 'mb';
        syncMeasurementHistoryFromCycles(expId, wt, cycles);
      }
    }
    populateSessionFilter();
    historyFiltered = buildFilteredHistory();
    renderHistoryCards();
  } catch (err) {
    console.warn('Gagal memuat semua riwayat eksperimen:', err);
  }
}
