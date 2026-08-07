// ============================================================================
// MICROWAT - History Page
// ============================================================================

let historyPage = 1;
const HIST_PER_PAGE = 20;
let historyFiltered = [];

function initHistoryPage() {
  console.log('🔧 Init History');

  historyPage = 1;
  historyFiltered = [...measurementHistory];

  document.getElementById('btn-export-csv')?.addEventListener('click', exportHistoryCSV);
  document.getElementById('btn-hist-filter')?.addEventListener('click', applyHistoryFilter);
  document.getElementById('hist-prev')?.addEventListener('click', () => {
    if (historyPage > 1) { historyPage--; renderHistoryCards(); }
  });
  document.getElementById('hist-next')?.addEventListener('click', () => {
    const maxPage = Math.ceil(historyFiltered.length / HIST_PER_PAGE);
    if (historyPage < maxPage) { historyPage++; renderHistoryCards(); }
  });

  // Dye type filters
  ['all', 'rc', 'mg', 'mb'].forEach(f => {
    document.getElementById(`filter-${f}`)?.addEventListener('click', () => {
      setActiveFilter(f);
    });
  });

  renderHistoryCards();
}

function setActiveFilter(filter) {
  ['all', 'rc', 'mg', 'mb'].forEach(f => {
    const btn = document.getElementById(`filter-${f}`);
    if (btn) {
      if (f === filter) {
        btn.className = 'px-lg py-xs font-label-caps text-label-caps bg-primary/20 text-primary border border-primary/50 rounded-[6px] transition-all';
      } else {
        btn.className = 'px-lg py-xs font-label-caps text-label-caps text-on-surface-variant/60 hover:text-on-surface-variant hover:bg-surface-container-highest/10 border border-transparent rounded-[6px] transition-all';
      }
    }
  });
  historyPage = 1;
  renderHistoryCards();
}

function applyHistoryFilter() {
  const from = document.getElementById('hist-date-from')?.value || '';
  const to = document.getElementById('hist-date-to')?.value || '';

  historyFiltered = measurementHistory.filter(m => {
    const date = new Date(m.timestamp).toISOString().split('T')[0];
    if (from && date < from) return false;
    if (to && date > to) return false;
    return true;
  });

  historyPage = 1;
  renderHistoryCards();
}

function renderHistoryCards() {
  const tbody = document.getElementById('history-table-body');
  if (!tbody) return;

  const total = historyFiltered.length;
  const start = (historyPage - 1) * HIST_PER_PAGE;
  const paged = historyFiltered.slice(start, start + HIST_PER_PAGE);

  const countEl = document.getElementById('hist-count-label');
  if (countEl) countEl.textContent = `Menampilkan ${Math.min(start + 1, total)}–${Math.min(start + HIST_PER_PAGE, total)} dari ${total} record`;

  const pageEl = document.getElementById('hist-page-info');
  if (pageEl) pageEl.textContent = historyPage;

  if (paged.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="px-lg py-lg text-center text-on-surface-variant font-body-md">
          <div class="flex flex-col items-center gap-sm">
            <span class="material-symbols-outlined text-[40px] text-outline">database</span>
            <span>Tidak ada data</span>
          </div>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = paged.map(m => {
    const deg = (m.degradation || 0).toFixed(1);
    const isSafe = parseFloat(deg) >= 70;
    return `
      <tr class="hover:bg-surface-container-high/50 transition-colors">
        <td class="px-lg py-md font-data-md text-on-surface text-[12px]">${new Date(m.timestamp).toLocaleString('id-ID')}</td>
        <td class="px-lg py-md font-data-md text-primary text-[12px]">${(m.absorbance || 0).toFixed(3)}</td>
        <td class="px-lg py-md font-data-md text-on-surface text-[12px]">${(m.concentration || 0).toFixed(2)}</td>
        <td class="px-lg py-md font-data-md text-[12px] ${isSafe ? 'text-tertiary' : 'text-error'}">${deg}%</td>
        <td class="px-lg py-md">
          <span class="px-xs py-xs rounded text-[10px] font-bold ${isSafe ? 'bg-tertiary/10 border border-tertiary text-tertiary' : 'bg-error/10 border border-error text-error'}">
            ${isSafe ? 'SAFE' : 'NOT SAFE'}
          </span>
        </td>
        <td class="px-lg py-md text-right">
          <button class="text-primary hover:underline text-[12px] flex items-center gap-xs ml-auto" onclick="downloadRowCSV('${m.timestamp}')">
            <span class="material-symbols-outlined text-[14px]">download</span> CSV
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

function downloadRowCSV(timestamp) {
  const m = measurementHistory.find(x => x.timestamp === timestamp);
  if (!m) return;
  const csv = `Waktu,Absorbansi,Konsentrasi (ppm),Degradasi (%),Status\n"${m.timestamp}",${m.absorbance || 0},${m.concentration || 0},${m.degradation || 0},"${m.status || 'Auto'}"`;
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `microwat-${new Date(m.timestamp).toISOString().split('T')[0]}.csv`;
  link.click();
}

function exportHistoryCSV() {
  if (measurementHistory.length === 0) {
    addNotification('⚠️ Tidak ada data untuk diekspor', 'warning');
    return;
  }
  let csv = 'Waktu,Absorbansi,Konsentrasi (ppm),Degradasi (%),Status\n';
  measurementHistory.forEach(m => {
    csv += `"${m.timestamp}",${m.absorbance || 0},${m.concentration || 0},${m.degradation || 0},"${m.status || 'Auto'}"\n`;
  });
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `microwat-${new Date().toISOString().split('T')[0]}.csv`;
  link.click();
  addNotification('✅ Data diekspor', 'success');
}
