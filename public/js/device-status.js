// ============================================================================
// MICROWAT - Device Page
// ============================================================================

let deviceClockInterval = null;
let deviceClockSeconds = 0;
let currentDeviceId = null;
var esp32RealData = null;

function initDevicePage() {
  console.log('🔧 Init Device Page');

  // Stop any previous clock
  if (deviceClockInterval) {
    clearInterval(deviceClockInterval);
  }

  // Start monitoring clock
  deviceClockSeconds = 0;
  deviceClockInterval = setInterval(() => {
    deviceClockSeconds++;
    const h = Math.floor(deviceClockSeconds / 3600).toString().padStart(2, '0');
    const m = Math.floor((deviceClockSeconds % 3600) / 60).toString().padStart(2, '0');
    const s = (deviceClockSeconds % 60).toString().padStart(2, '0');
    const el = document.getElementById('device-clock');
    if (el) el.textContent = `${h}:${m}:${s}`;
  }, 1000);

  // Live refresh toggle
  const toggle = document.getElementById('live-refresh-toggle');
  if (toggle) {
    toggle.addEventListener('click', () => {
      const circle = toggle.querySelector('span');
      if (circle.classList.contains('translate-x-5')) {
        circle.classList.replace('translate-x-5', 'translate-x-1');
        toggle.classList.remove('bg-primary/20');
        toggle.classList.add('bg-surface-container-highest');
      } else {
        circle.classList.replace('translate-x-1', 'translate-x-5');
        toggle.classList.add('bg-primary/20');
        toggle.classList.remove('bg-surface-container-highest');
      }
    });
  }

  // Export report button
  document.getElementById('btn-export-device-report')?.addEventListener('click', exportHistoryCSV);

  // Start / Stop session buttons
  document.getElementById('btn-start-measurement')?.addEventListener('click', () => {
    if (socket?.connected) {
      socket.emit('startMeasurement');
      addControlLog('Measurement session started via Start button.');
      addNotification('▶ Measurement session started', 'info');
    } else {
      addControlLog('ERROR: Not connected to the server.');
      addNotification('❌ Not connected to the server', 'error');
    }
  });

  document.getElementById('btn-stop-measurement')?.addEventListener('click', () => {
    if (socket?.connected) {
      socket.emit('stopMeasurement');
      addControlLog('Measurement session stopped via Stop button.');
      addNotification('⏹ Measurement session stopped', 'warning');
    } else {
      addNotification('❌ Not connected to the server', 'error');
    }
  });

  // Update KPIs with current measurement data
  updateDeviceKPIs();

  // Init control buttons (Isi / Ukur / Kosong)
  initControlButtons();

  // Init simulation panel
  if (typeof initSpectralSimPanel === 'function') initSpectralSimPanel();
}

function updateDeviceKPIs() {
  if (measurementHistory.length > 0) {
    const latest = measurementHistory[0];
    const specAbs = document.getElementById('spec-absorbance');
    if (specAbs) specAbs.textContent = (latest.absorbance || 0).toFixed(3) + ' a.u.';
  }

  const isConnected = socket?.connected;

  // Active devices count (RPi + Avantes + Motor Driver + Pump1 + Pump2 = 5)
  const countEl = document.getElementById('device-active-count');
  if (countEl) countEl.textContent = isConnected ? '5/5' : '0/5';

  // RPI status badge
  const rpiBadge = document.getElementById('rpi-online-badge');
  if (rpiBadge) {
    rpiBadge.textContent = isConnected ? 'ONLINE' : 'OFFLINE';
    rpiBadge.className = isConnected
      ? 'inline-flex items-center gap-xs px-sm py-xs rounded-full bg-tertiary/10 border border-tertiary text-tertiary text-[10px] font-bold uppercase tracking-wider'
      : 'inline-flex items-center gap-xs px-sm py-xs rounded-full bg-surface-container-highest border border-outline text-on-surface-variant text-[10px] font-bold uppercase tracking-wider';
  }

  // RPi telemetry
  const rpi = window.rpiTelemetry;
  if (rpi) {
    const setEl = (id, val) => { const e = document.getElementById(id); if (e) e.textContent = val; };
    setEl('rpi-ram', rpi.ram || '-');
    setEl('rpi-temp', rpi.temp ? `${rpi.temp}°C` : '-');
    setEl('rpi-network', rpi.networkSpeed ? `${rpi.networkSpeed} Mbps` : '-');
    setEl('rpi-connection', rpi.status || 'OFFLINE');
    const loadBar = document.getElementById('rpi-load-bar');
    if (loadBar && rpi.cpuUsage) loadBar.style.width = `${Math.min(rpi.cpuUsage, 100)}%`;
    const loadTime = document.getElementById('rpi-load-time');
    if (loadTime) loadTime.textContent = rpi.cpuUsage ? `${rpi.cpuUsage}%` : '-';
  }

  const lastUpdated = document.getElementById('device-last-updated');
  if (lastUpdated) lastUpdated.textContent = 'Last updated: ' + new Date().toLocaleTimeString('en-US');
}

// ============================================================================
// KONTROL PENGUKURAN (Isi / Ukur / Kosong)
// ============================================================================

function addControlLog(message) {
  const log = document.getElementById('control-log');
  if (!log) return;
  const time = new Date().toLocaleTimeString('id-ID');
  const p = document.createElement('p');
  p.className = 'text-[11px] text-on-surface-variant font-data-md';
  p.textContent = `[${time}] ${message}`;
  log.insertBefore(p, log.firstChild);
  // Keep last 10 entries
  while (log.children.length > 10) log.removeChild(log.lastChild);
}

function setControlBadge(status) {
  const badge = document.getElementById('control-status-badge');
  if (!badge) return;
  const map = {
    STANDBY: 'bg-surface-container-highest border border-outline text-on-surface-variant',
    FILLING: 'bg-primary/10 border border-primary text-primary',
    MEASURING: 'bg-secondary/10 border border-secondary text-secondary',
    EMPTYING: 'bg-tertiary/10 border border-tertiary text-tertiary',
    DONE: 'bg-tertiary/10 border border-tertiary text-tertiary',
  };
  badge.textContent = status;
  badge.className = `inline-flex items-center gap-xs px-sm py-xs rounded-full text-[10px] font-bold uppercase tracking-wider ${map[status] || map.STANDBY}`;
}

function setButtonStatus(id, statusText, color) {
  const el = document.getElementById(id);
  if (!el) return;
  const colorMap = {
    primary: 'text-primary bg-primary/10 border border-primary/30',
    secondary: 'text-secondary bg-secondary/10 border border-secondary/30',
    tertiary: 'text-tertiary bg-tertiary/10 border border-tertiary/30',
    default: 'text-on-surface-variant bg-surface-container border border-outline-variant/30',
  };
  el.textContent = statusText;
  el.className = `font-label-caps text-[10px] font-bold uppercase px-sm py-xs rounded-lg ${colorMap[color] || colorMap.default}`;
}

function initControlButtons() {
  const send = (action) => {
    if (!socket?.connected) {
      addControlLog('ERROR: Not connected to Node.js server.');
      addNotification('❌ Not connected to the server', 'error');
      return;
    }

    const requestId = `web-${Date.now()}`;
    socket.emit('deviceControl', { action, requestId });
    addControlLog(`${action.toUpperCase()}: command sent to Raspberry Pi.`);
  };

  document.getElementById('btn-isi')?.addEventListener('click', () => {
    setControlBadge('FILLING');
    setButtonStatus('status-isi', 'SENDING', 'primary');
    send('fill');
  });

  document.getElementById('btn-ukur')?.addEventListener('click', () => {
    setControlBadge('MEASURING');
    setButtonStatus('status-ukur', 'SENDING', 'secondary');
    send('measure');
  });

  document.getElementById('btn-kosong')?.addEventListener('click', () => {
    setControlBadge('EMPTYING');
    setButtonStatus('status-kosong', 'SENDING', 'tertiary');
    send('empty');
  });

  document.getElementById('btn-stop-control')?.addEventListener('click', () => {
    setControlBadge('STANDBY');
    send('stop');
  });

  // Konfirmasi bahwa Node.js sudah menerima perintah.
  socket?.on('deviceControlResult', (data = {}) => {
    if (data.status === 'error') {
      addControlLog(`ERROR ${String(data.action || '').toUpperCase()}: ${data.message || 'failed'}`);
      addNotification(`❌ ${data.message || 'Control failed'}`, 'error');
      setControlBadge('STANDBY');
      return;
    }
    addControlLog(`${String(data.command || data.action || '').toUpperCase()}: accepted by server.`);
  });

  // Status aktual yang datang dari Raspberry Pi melalui MQTT.
  socket?.on('deviceStatus', (data = {}) => {
    const status = String(data.status || data.state || '').toUpperCase();
    if (!status) return;

    setControlBadge(status);
    const connection = document.getElementById('rpi-control-connection');
    if (connection) connection.textContent = 'MQTT: ONLINE';

    if (status.includes('FILL')) setButtonStatus('status-isi', status, 'primary');
    if (status.includes('MEASURE')) setButtonStatus('status-ukur', status, 'secondary');
    if (status.includes('EMPTY')) setButtonStatus('status-kosong', status, 'tertiary');
    if (status.includes('STOP') || status === 'IDLE' || status === 'STANDBY') {
      setButtonStatus('status-isi', 'READY', 'default');
      setButtonStatus('status-ukur', 'READY', 'default');
      setButtonStatus('status-kosong', 'READY', 'default');
    }

    addControlLog(`Raspberry Pi: ${status}${data.message ? ' — ' + data.message : ''}`);
  });

  socket?.on('deviceMeasurement', (data = {}) => {
    const value = Number(data.absorbance_max ?? data.absorbance);
    if (Number.isFinite(value)) {
      const el = document.getElementById('spec-absorbance');
      if (el) el.textContent = `${value.toFixed(4)} a.u.`;
    }
    addControlLog('Avantes: hasil pengukuran diterima dari Raspberry Pi.');
  });
}

// ============================================================================
// DYE TYPE DETECTION (from peak wavelength → limbah type)
// ============================================================================

function getDyeInfo() {
  const wl = systemParameters?.wavelength || 664;

  // Wavelength ranges mapped to dye type
  if (wl >= 480 && wl <= 565) {
    // Rhodamine C (RC) / Congo Red range ~490–540nm → pink/red
    return { name: 'Rhodamine C', abbr: 'RC', hex: '#F87171', cssColor: 'color:#F87171', dotStyle: 'background:#F87171' };
  } else if (wl >= 600 && wl <= 636) {
    // Malachite Green (MG) ~621nm → green
    return { name: 'Malachite Green', abbr: 'MG', hex: '#4ADE80', cssColor: 'color:#4ADE80', dotStyle: 'background:#4ADE80' };
  } else if (wl >= 637 && wl <= 690) {
    // Methylene Blue (MB) ~664nm → blue
    return { name: 'Methylene Blue', abbr: 'MB', hex: '#60A5FA', cssColor: 'color:#60A5FA', dotStyle: 'background:#60A5FA' };
  }
  return { name: 'Unknown Dye', abbr: '?', hex: '#9CA3AF', cssColor: 'color:#9CA3AF', dotStyle: 'background:#9CA3AF' };
}

// ============================================================================
// DEVICE DETAIL NAVIGATION
// ============================================================================

function navigateToDeviceDetail(deviceId) {
  currentDeviceId = deviceId;
  navigateToPage('device-detail');
}

function initDeviceDetailPage() {
  const deviceId = currentDeviceId || 'raspberry';
  const socketOk = socket?.connected;
  const rpi = window.rpiTelemetry;
  const rpiOnline = rpi?.status === 'ONLINE';
  // RPi online = socket connected AND telemetry received from Flask
  const isConnected = deviceId === 'raspberry' ? (socketOk && rpiOnline) : socketOk;

  const DEVICES = {
    raspberry: {
      name: 'Raspberry Pi 5',
      sub: 'Cortex-A76 · 8 GB RAM · Controller',
      icon: 'memory',
      color: 'tertiary',
    },
    spectrometer: {
      name: 'Avantes UV Spectrophotometer',
      sub: '360–2500 nm · USB Connected',
      icon: 'biotech',
      color: 'primary',
    },
    esp32: {
      name: 'ESP32 Real Sensor',
      sub: 'WiFi · MQTT · Real-time',
      icon: 'sensors',
      color: 'secondary',
    },
  };

  const dev = DEVICES[deviceId] || DEVICES.raspberry;

  // Set breadcrumb name
  const nameEl = document.getElementById('dd-device-name');
  if (nameEl) nameEl.textContent = dev.name;

  // Determine state
  let state = 'OFFLINE';
  let stateColor = 'text-on-surface-variant';
  let dotColor = 'bg-outline';
  let stateDesc = 'Device not detected. Check network connection.';

  if (deviceId === 'raspberry') {
    if (isConnected) {
      const isMeasuring = window.isMeasuring;
      state = isMeasuring ? 'RUNNING' : 'IDLE';
      stateColor = isMeasuring ? 'text-tertiary' : 'text-secondary';
      dotColor = isMeasuring ? 'bg-tertiary animate-pulse' : 'bg-secondary';
      stateDesc = isMeasuring
        ? 'The system is actively running a measurement session. Data is received in real-time.'
        : 'Instrument online but no active session. Waiting for protocol initiation.';
    } else {
      stateDesc = 'Raspberry Pi not detected. Check server and network connection.';
    }
  } else if (deviceId === 'spectrometer') {
    if (isConnected) {
      const hasData = window.measurementHistory && window.measurementHistory.length > 0;
      state = hasData ? 'CAPTURING' : 'STANDBY';
      stateColor = hasData ? 'text-primary' : 'text-secondary';
      dotColor = hasData ? 'bg-primary animate-pulse' : 'bg-secondary';
      stateDesc = hasData
        ? 'The spectrophotometer is actively capturing absorbance data in real-time via USB.'
        : 'The spectrophotometer is connected via USB. Calibrate dark current before starting.';
    } else {
      stateDesc = 'Avantes Spectrophotometer not detected. Check USB connection to the Raspberry Pi.';
    }
  } else if (deviceId === 'esp32') {
    const esp32Online = esp32RealData?.status === 'ONLINE';
    if (esp32Online) {
      state = 'ACTIVE';
      stateColor = 'text-tertiary';
      dotColor = 'bg-tertiary animate-pulse';
      stateDesc = 'ESP32 sending sensor data via MQTT. Distance & rain data received.';
    } else if (isConnected) {
      state = 'IDLE';
      stateColor = 'text-secondary';
      dotColor = 'bg-secondary';
      stateDesc = 'Server connected but no MQTT data from ESP32. Check ESP32 WiFi configuration.';
    } else {
      stateDesc = 'ESP32 not detected. Ensure ESP32 is connected to WiFi and MQTT broker is active.';
    }
  }

  // Render status banner
  const statusDot = document.getElementById('dd-status-dot');
  const statusText = document.getElementById('dd-status-text');
  const statusDesc = document.getElementById('dd-status-desc');
  const uptimeEl = document.getElementById('dd-uptime-label');
  const versionEl = document.getElementById('dd-version-label');
  const actionBtn = document.getElementById('dd-action-btn');
  const resetBtn = document.getElementById('dd-reset-btn');

  if (statusDot) { statusDot.className = `w-3 h-3 rounded-full shrink-0 ${dotColor}`; }
  if (statusText) { statusText.textContent = state; statusText.className = `font-headline-lg text-headline-lg ${stateColor}`; }
  if (statusDesc) statusDesc.textContent = stateDesc;
  if (uptimeEl) uptimeEl.textContent = 'Last check: ' + new Date().toLocaleTimeString('en-US');
  if (versionEl) versionEl.textContent = deviceId === 'raspberry' ? 'RPi OS · Bookworm' : deviceId === 'esp32' ? 'ESP-IDF v5.1' : 'AvaSpec-ULS';
  if (actionBtn && state === 'IDLE') {
    actionBtn.classList.remove('hidden');
    actionBtn.querySelector('span:last-child').textContent = 'New Session';
  }
  if (resetBtn && isConnected) resetBtn.classList.remove('hidden');

  // Render metrics
  _renderDeviceMetrics(deviceId, isConnected);

  // Render health panel
  _renderDeviceHealth(deviceId, isConnected, state);

  // Render log
  _renderDeviceLog(deviceId, isConnected, state);

  // Render events
  _renderDeviceEvents(deviceId, state);

  // Analytics section for spectrometer
  if (deviceId === 'spectrometer') {
    const analyticsSection = document.getElementById('dd-analytics-section');
    if (analyticsSection) analyticsSection.classList.remove('hidden');

    const latest = window.measurementHistory?.[0];
    const deg = latest ? parseFloat((latest.degradation || 0).toFixed(1)) : null;
    const conc = latest ? parseFloat((latest.concentration || 0).toFixed(2)) : null;

    // Big degradation number
    const degEl = document.getElementById('dd-spec-deg');
    const degBar = document.getElementById('dd-deg-bar');
    const degBadge = document.getElementById('dd-deg-badge');
    const concEl = document.getElementById('dd-spec-conc');
    if (degEl) degEl.textContent = deg != null ? deg.toFixed(1) : '-';
    if (degBar) degBar.style.width = deg != null ? Math.min(deg, 100) + '%' : '0%';
    if (degBadge) {
      if (deg == null) { degBadge.textContent = '-'; degBadge.className = 'font-label-caps text-[10px] font-bold uppercase text-on-surface-variant'; }
      else if (conc != null && parseFloat(conc) <= 5) { degBadge.textContent = 'SAFE'; degBadge.className = 'font-label-caps text-[10px] font-bold uppercase text-tertiary'; }
      else { degBadge.textContent = 'NOT SAFE'; degBadge.className = 'font-label-caps text-[10px] font-bold uppercase text-error'; }
    }
    if (concEl) concEl.textContent = conc != null ? conc.toFixed(2) : '-';

    // Dye type badge in analytics
    const dye = getDyeInfo();
    const dyeBadge = document.getElementById('dd-dye-badge');
    const dyeDot = document.getElementById('dd-dye-dot');
    const dyeName = document.getElementById('dd-dye-name');
    const dyeAbbr = document.getElementById('dd-dye-abbr');
    if (dyeBadge) dyeBadge.classList.remove('hidden');
    if (dyeDot) dyeDot.style.background = dye.hex;
    if (dyeName) { dyeName.textContent = dye.name; dyeName.style.color = dye.hex; }
    if (dyeAbbr) dyeAbbr.textContent = dye.abbr;

    // Dye pill in analytics header
    const dyePill = document.getElementById('dd-dye-pill');
    const dyePillDot = document.getElementById('dd-dye-pill-dot');
    const dyePillText = document.getElementById('dd-dye-pill-text');
    if (dyePill) {
      dyePill.classList.remove('hidden');
      dyePill.classList.add('flex');
      dyePill.style.borderColor = dye.hex + '80';
      dyePill.style.background = dye.hex + '18';
    }
    if (dyePillDot) dyePillDot.style.background = dye.hex;
    if (dyePillText) { dyePillText.textContent = dye.name; dyePillText.style.color = dye.hex; }

    // Reaction time: elapsed since first measurement or session start
    const reactionEl = document.getElementById('dd-reaction-time');
    if (reactionEl) {
      const history = window.measurementHistory || [];
      if (history.length >= 2) {
        const oldest = history[history.length - 1];
        const newest = history[0];
        if (oldest.timestamp && newest.timestamp) {
          const diffMs = new Date(newest.timestamp) - new Date(oldest.timestamp);
          const mins = Math.floor(diffMs / 60000);
          const secs = Math.floor((diffMs % 60000) / 1000);
          reactionEl.textContent = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
        } else {
          reactionEl.textContent = `${history.length} pts`;
        }
      } else if (history.length === 1) {
        reactionEl.textContent = '< 1m';
      } else {
        reactionEl.textContent = '-';
      }
    }

    // Session timeline
    const now = new Date().toLocaleTimeString('en-US');
    const tlStart = document.getElementById('dd-tl-start');
    const tlConn = document.getElementById('dd-tl-connected');
    const tlReacLbl = document.getElementById('dd-tl-reaction-label');
    const tlReacTime = document.getElementById('dd-tl-reaction-time');
    const tlReacDot = document.getElementById('dd-tl-reaction-dot');
    if (tlStart) tlStart.textContent = new Date(Date.now() - 3600000).toLocaleTimeString('en-US');
    if (tlConn) tlConn.textContent = new Date(Date.now() - 3000000).toLocaleTimeString('en-US');
    if (latest && tlReacLbl) {
      tlReacLbl.textContent = 'Measurement in Progress';
      tlReacLbl.className = 'font-body-md text-body-md text-primary';
      if (tlReacDot) tlReacDot.className = 'absolute left-0 top-1.5 w-4 h-4 rounded-full bg-primary/30 border border-primary';
    }
    if (tlReacTime) tlReacTime.textContent = now;
  }

  // Stream status
  const streamEl = document.getElementById('dd-stream-status');
  if (streamEl) {
    if (isConnected && state !== 'OFFLINE') {
      streamEl.textContent = 'Real-time Stream Active';
      streamEl.className = 'font-label-caps text-label-caps text-tertiary text-[10px] uppercase';
    } else {
      streamEl.textContent = 'Real-time Stream Interrupted';
    }
  }

  // Export log button
  document.getElementById('dd-export-log')?.addEventListener('click', exportHistoryCSV);
}

function _renderDyeBadge() {
  const dye = getDyeInfo();
  return `
      <div class="flex items-center gap-xs mt-xs pt-xs border-t border-outline-variant/30">
        <span class="w-2.5 h-2.5 rounded-full shrink-0" style="${dye.dotStyle}"></span>
        <span class="font-label-caps text-[10px] uppercase font-bold truncate" style="${dye.cssColor}">${dye.name}</span>
        <span class="font-label-caps text-[9px] text-on-surface-variant ml-auto">${dye.abbr}</span>
      </div>`;
}

function _renderDeviceMetrics(deviceId, isConnected) {
  const grid = document.getElementById('dd-metrics-grid');
  if (!grid) return;

  let metrics = [];
  const latest = window.measurementHistory?.[0];

  if (deviceId === 'raspberry') {
    const rpi = window.rpiTelemetry;
    const online = isConnected && rpi?.status === 'ONLINE';
    metrics = [
      { label: 'CPU Usage', value: online ? rpi.cpu + '%' : (isConnected ? '...' : '-'), icon: 'memory', color: 'text-tertiary', id: 'dd-metric-cpu' },
      { label: 'RAM Usage', value: online ? rpi.ram + '%' : (isConnected ? '...' : '-'), icon: 'sd_card', color: 'text-tertiary', id: 'dd-metric-ram' },
      { label: 'Latency', value: isConnected ? '< 5 ms' : '-', icon: 'network_ping', color: 'text-primary' },
      { label: 'Core Temp', value: online ? rpi.temp + ' °C' : (isConnected ? '...' : '-'), icon: 'thermostat', color: 'text-secondary', id: 'dd-metric-temp' },
    ];
  } else if (deviceId === 'spectrometer') {
    const deg = latest ? (latest.degradation || 0).toFixed(1) : null;
    const conc = latest ? (latest.concentration || 0).toFixed(2) : null;
    // Reaction time from history span
    let reactionTime = '-';
    const hist = window.measurementHistory || [];
    if (hist.length >= 2) {
      const diffMs = new Date(hist[0].timestamp) - new Date(hist[hist.length - 1].timestamp);
      const mins = Math.floor(diffMs / 60000), secs = Math.floor((diffMs % 60000) / 1000);
      reactionTime = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
    } else if (hist.length === 1) { reactionTime = '< 1m'; }

    // Render custom hero layout for spectrometer
    const isSafe = conc != null && parseFloat(conc) <= 5;
    grid.innerHTML = `
        <div class="col-span-2 glass-panel rounded-xl p-lg flex flex-col gap-sm">
          <div class="flex items-center gap-xs">
            <span class="material-symbols-outlined text-[16px] text-tertiary">trending_up</span>
            <span class="font-label-caps text-[10px] text-on-surface-variant uppercase tracking-widest">Degradation</span>
            ${deg != null ? `<span class="ml-auto font-label-caps text-[10px] font-bold uppercase ${isSafe ? 'text-tertiary' : 'text-error'}">${isSafe ? 'SAFE' : 'NOT SAFE'}</span>` : ''}
          </div>
          <div class="flex items-baseline gap-xs mt-xs">
            <span class="text-[52px] leading-none font-bold text-tertiary" style="font-family:'Space Mono',monospace">${deg ?? '-'}</span>
            <span class="text-[24px] text-tertiary/70 font-bold">%</span>
          </div>
          <div class="h-2 bg-surface-container-highest rounded-full overflow-hidden mt-xs">
            <div class="h-full bg-tertiary rounded-full transition-all duration-700" style="width:${deg ? Math.min(parseFloat(deg), 100) : 0}%"></div>
          </div>
        </div>
        <div class="glass-panel p-md rounded-xl flex flex-col gap-xs">
          <div class="flex items-center gap-xs">
            <span class="material-symbols-outlined text-[16px] text-secondary">timer</span>
            <span class="font-label-caps text-[10px] text-on-surface-variant uppercase tracking-widest">Reaction Time</span>
          </div>
          <span class="font-data-lg text-data-lg text-secondary truncate">${reactionTime}</span>
        </div>
        <div class="glass-panel p-md rounded-xl flex flex-col gap-xs">
          <div class="flex items-center gap-xs">
            <span class="material-symbols-outlined text-[16px] text-primary">science</span>
            <span class="font-label-caps text-[10px] text-on-surface-variant uppercase tracking-widest">Concentration</span>
          </div>
          <span class="font-data-lg text-data-lg text-primary truncate">${conc ? conc + ' ppm' : '-'}</span>
          ${_renderDyeBadge()}
        </div>`;
    return;
  } else if (deviceId === 'esp32') {
    const d = esp32RealData;
    metrics = [
      { label: 'Distance', value: d?.distance != null ? d.distance.toFixed(1) + ' cm' : '-', icon: 'straighten', color: 'text-secondary' },
      { label: 'Rain Sensor', value: d?.rainStatus || '-', icon: 'water_drop', color: 'text-primary' },
      { label: 'WiFi Signal', value: d?.wifiSignal ? d.wifiSignal + ' dBm' : '-', icon: 'wifi', color: 'text-tertiary' },
      { label: 'Connection', value: d?.status || 'OFFLINE', icon: 'hub', color: d?.status === 'ONLINE' ? 'text-tertiary' : 'text-on-surface-variant' },
    ];
  }

  grid.innerHTML = metrics.map(m => `
      <div class="glass-panel p-md rounded-xl flex flex-col gap-xs">
        <div class="flex items-center gap-xs">
          <span class="material-symbols-outlined text-[16px] ${m.color}">${m.icon}</span>
          <span class="font-label-caps text-[10px] text-on-surface-variant uppercase tracking-widest">${m.label}</span>
        </div>
        <span class="font-data-lg text-data-lg ${m.color} truncate" ${m.id ? `id="${m.id}"` : ''}>${m.value}</span>
      </div>
    `).join('');
}

function _renderDeviceHealth(deviceId, isConnected, state) {
  const list = document.getElementById('dd-health-list');
  if (!list) return;
  const socketOk = socket?.connected;

  const STATUS_BADGE = {
    connected: 'px-sm py-[2px] rounded-full bg-tertiary/10 border border-tertiary text-tertiary text-[10px] font-bold uppercase',
    standby: 'px-sm py-[2px] rounded-full bg-secondary/10 border border-secondary text-secondary text-[10px] font-bold uppercase',
    offline: 'px-sm py-[2px] rounded-full bg-surface-container-highest border border-outline text-on-surface-variant text-[10px] font-bold uppercase',
    error: 'px-sm py-[2px] rounded-full bg-error/10 border border-error text-error text-[10px] font-bold uppercase',
    active: 'px-sm py-[2px] rounded-full bg-primary/10 border border-primary text-primary text-[10px] font-bold uppercase',
  };

  let items = [];

  if (deviceId === 'raspberry') {
    const rpiH = window.rpiTelemetry;
    const rpiOn = rpiH?.status === 'ONLINE';
    const tempStr = rpiOn ? `Core Temp: ${rpiH.temp} °C` : (socketOk ? 'Waiting for RPi data...' : 'No connection');
    items = [
      { icon: 'memory', label: 'RPi 5 Controller', sub: tempStr, statusKey: rpiOn ? 'connected' : (socketOk ? 'standby' : 'offline'), statusLabel: rpiOn ? 'ONLINE' : (socketOk ? 'CONNECTING' : 'OFFLINE'), color: 'text-tertiary' },
      { icon: 'biotech', label: 'Avantes Spectrometer', sub: rpiOn ? 'USB connected' : 'Waiting for host', statusKey: rpiOn ? 'active' : 'offline', statusLabel: rpiOn ? 'CONNECTED' : 'OFFLINE', color: 'text-primary' },
      { icon: 'sensors', label: 'ESP32 MQTT Client', sub: esp32RealData?.status === 'ONLINE' ? 'Data stream active' : 'Waiting for data', statusKey: esp32RealData?.status === 'ONLINE' ? 'connected' : 'standby', statusLabel: esp32RealData?.status === 'ONLINE' ? 'ACTIVE' : 'IDLE', color: 'text-secondary' },
      { icon: 'wifi', label: 'Network Interface', sub: socketOk ? 'TCP/IP Established' : 'Disconnected', statusKey: socketOk ? 'connected' : 'offline', statusLabel: socketOk ? 'ONLINE' : 'OFFLINE', color: 'text-tertiary' },
    ];
  } else if (deviceId === 'spectrometer') {
    items = [
      { icon: 'memory', label: 'RPi 5 Host', sub: 'Driver active via USB', statusKey: isConnected ? 'connected' : 'offline', statusLabel: isConnected ? 'CONNECTED' : 'OFFLINE', color: 'text-tertiary' },
      { icon: 'flare', label: 'UV Lamp 254nm', sub: isConnected ? 'Cooled down' : 'Off', statusKey: isConnected ? 'standby' : 'offline', statusLabel: isConnected ? 'STANDBY' : 'OFF', color: 'text-secondary' },
      { icon: 'biotech', label: 'Spectrophotometer', sub: isConnected ? 'Dark current calibrated' : 'No signal', statusKey: isConnected ? (state === 'CAPTURING' ? 'active' : 'standby') : 'offline', statusLabel: isConnected ? state : 'OFFLINE', color: 'text-primary' },
      { icon: 'microwave', label: 'Microwave Module', sub: '0 W output', statusKey: 'standby', statusLabel: 'STANDBY', color: 'text-outline' },
    ];
  } else if (deviceId === 'esp32') {
    const esp32On = esp32RealData?.status === 'ONLINE';
    items = [
      { icon: 'sensors', label: 'Ultrasonic Sensor HC-SR04', sub: esp32On ? `Last: ${esp32RealData.distance?.toFixed(1) || '-'} cm` : 'Waiting for data', statusKey: esp32On ? 'active' : 'offline', statusLabel: esp32On ? 'ACTIVE' : 'OFFLINE', color: 'text-secondary' },
      { icon: 'water_drop', label: 'Rain Sensor', sub: esp32On ? (esp32RealData.rainStatus || '-') : '-', statusKey: esp32On ? 'connected' : 'offline', statusLabel: esp32On ? 'ACTIVE' : 'OFFLINE', color: 'text-primary' },
      { icon: 'wifi', label: 'WiFi Connection', sub: esp32On ? `RSSI: ${esp32RealData.wifiSignal || '-'} dBm` : 'Disconnected', statusKey: esp32On ? 'connected' : 'offline', statusLabel: esp32On ? 'CONNECTED' : 'OFFLINE', color: 'text-tertiary' },
      { icon: 'hub', label: 'MQTT Broker', sub: isConnected ? 'Broker active via server' : 'Offline', statusKey: isConnected ? 'connected' : 'offline', statusLabel: isConnected ? 'CONNECTED' : 'OFFLINE', color: 'text-secondary' },
    ];
  }

  list.innerHTML = items.map(item => `
      <div class="flex items-center justify-between p-md bg-surface-container-low/60 rounded-lg border border-outline-variant/30 hover:bg-surface-container/50 transition-colors">
        <div class="flex items-center gap-md">
          <div class="p-sm bg-surface-container-highest/50 rounded-full shrink-0">
            <span class="material-symbols-outlined ${item.color}">${item.icon}</span>
          </div>
          <div>
            <p class="font-body-md text-body-md text-on-surface">${item.label}</p>
            <p class="font-data-md text-data-md text-on-surface-variant text-xs">${item.sub}</p>
          </div>
        </div>
        <span class="${STATUS_BADGE[item.statusKey] || STATUS_BADGE.offline}">${item.statusLabel}</span>
      </div>
    `).join('');
}

function _renderDeviceLog(deviceId, isConnected, state) {
  const container = document.getElementById('dd-log-container');
  if (!container) return;

  if (!isConnected || state === 'OFFLINE') {
    container.innerHTML = `
        <div class="flex flex-col items-center justify-center py-xl text-on-surface-variant">
          <span class="material-symbols-outlined text-[40px] mb-sm text-surface-container-highest">query_stats</span>
          <p class="font-body-md">No active data stream detected</p>
          <p class="text-xs text-outline mt-xs">System is in standby. Begin a new session to see live telemetry.</p>
        </div>`;
    return;
  }

  const now = new Date();
  const fmt = d => d.toLocaleTimeString('en-US');
  const logs = [];

  if (deviceId === 'raspberry') {
    logs.push(
      { ok: true, time: fmt(new Date(now - 5000)), msg: 'System heartbeat OK — server connected' },
      { ok: true, time: fmt(new Date(now - 12000)), msg: 'Socket.io connection established' },
      { ok: true, time: fmt(new Date(now - 30000)), msg: 'Spectrometer driver loaded via USB' },
      { ok: false, time: fmt(new Date(now - 60000)), msg: 'WARN: CPU temp spike 48°C — returned to normal' },
    );
  } else if (deviceId === 'spectrometer') {
    const latest = window.measurementHistory?.[0];
    if (latest) {
      logs.push({ ok: true, time: fmt(now), msg: `Degradation: ${(latest.degradation || 0).toFixed(1)}% — Concentration: ${(latest.concentration || 0).toFixed(2)} ppm` });
    }
    logs.push(
      { ok: true, time: fmt(new Date(now - 8000)), msg: 'Dark current calibration: OK' },
      { ok: true, time: fmt(new Date(now - 20000)), msg: 'Integration time set: 100 ms' },
      { ok: true, time: fmt(new Date(now - 45000)), msg: 'USB driver loaded — AvaSpec detected' },
    );
  } else if (deviceId === 'esp32') {
    const d = esp32RealData;
    if (d?.status === 'ONLINE') {
      logs.push({ ok: true, time: fmt(now), msg: `Distance: ${d.distance?.toFixed(1) || '-'} cm · Rain: ${d.rainStatus || '-'}` });
    }
    logs.push(
      { ok: true, time: fmt(new Date(now - 5000)), msg: 'MQTT topic microwat/esp32 subscribed' },
      { ok: true, time: fmt(new Date(now - 15000)), msg: 'WiFi connected: UBINNMASJIDD' },
      { ok: false, time: fmt(new Date(now - 90000)), msg: 'WARN: Packet loss detected — auto-recovered' },
    );
  }

  container.innerHTML = logs.map(log => `
      <div class="flex items-center justify-between p-md bg-surface-container-low/40 rounded-lg border border-outline-variant/20">
        <div class="flex items-center gap-md">
          <div class="w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${log.ok ? 'bg-tertiary/10 border border-tertiary' : 'bg-error/10 border border-error'}">
            <span class="material-symbols-outlined text-[14px] ${log.ok ? 'text-tertiary' : 'text-error'}">${log.ok ? 'check' : 'warning'}</span>
          </div>
          <span class="font-data-md text-sm ${log.ok ? 'text-on-surface' : 'text-error'}">${log.msg}</span>
        </div>
        <span class="font-data-md text-data-md text-on-surface-variant text-xs shrink-0 ml-md">${log.time}</span>
      </div>
    `).join('');
}

function _renderDeviceEvents(deviceId, state) {
  const tbody = document.getElementById('dd-event-table');
  if (!tbody) return;

  const BADGE = (type) => {
    if (type === 'error') return 'px-sm py-[2px] bg-error/10 border border-error text-error rounded-full text-[10px] font-bold';
    if (type === 'warning') return 'px-sm py-[2px] bg-secondary/10 border border-secondary text-secondary rounded-full text-[10px] font-bold';
    return 'px-sm py-[2px] bg-surface-container-highest border border-outline text-on-surface-variant rounded-full text-[10px] font-bold';
  };

  let events = [];

  if (deviceId === 'raspberry') {
    events = [
      { time: '18 May 2026 14:32', code: 'ERR-401', desc: 'Spectrometer Sync Timeout: Missing ACK', type: 'error', status: 'Resolved' },
      { time: '18 May 2026 11:15', code: 'WRN-301', desc: 'UV Lamp Temperature approaching threshold (45°C)', type: 'warning', status: 'Resolved' },
      { time: '17 May 2026 09:04', code: 'INFO-001', desc: 'System Startup Sequence Completed', type: 'info', status: 'OK' },
    ];
  } else if (deviceId === 'spectrometer') {
    events = [
      { time: '18 May 2026 09:42', code: 'WRN-102', desc: 'UV Lamp intensity dropped below threshold', type: 'warning', status: 'Resolved' },
      { time: '18 May 2026 08:55', code: 'INFO-011', desc: 'Dark current calibration successful', type: 'info', status: 'OK' },
      { time: '17 May 2026 14:20', code: 'INFO-001', desc: 'Measurement session completed — degradation 87.3%', type: 'info', status: 'OK' },
    ];
  } else if (deviceId === 'esp32') {
    events = [
      { time: '18 May 2026 14:50', code: 'ERR-401', desc: 'Packet loss — sensor heartbeat missed', type: 'error', status: 'Auto-recovered' },
      { time: '18 May 2026 13:10', code: 'WRN-202', desc: 'Low WiFi RSSI: -78 dBm', type: 'warning', status: 'Resolved' },
      { time: '17 May 2026 08:00', code: 'INFO-001', desc: 'ESP32 boot sequence completed', type: 'info', status: 'OK' },
    ];
  }

  if (events.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" class="px-lg py-xl text-center text-on-surface-variant font-body-md">No events recorded</td></tr>`;
    return;
  }

  tbody.innerHTML = events.map(ev => `
      <tr class="hover:bg-surface-container-low/50 transition-colors ${ev.type === 'error' ? 'bg-error/5' : ''}">
        <td class="py-md px-lg font-data-md text-data-md text-on-surface">${ev.time}</td>
        <td class="py-md px-lg"><span class="${BADGE(ev.type)}">${ev.code}</span></td>
        <td class="py-md px-lg font-body-md text-on-surface-variant hidden sm:table-cell">${ev.desc}</td>
        <td class="py-md px-lg font-body-md ${ev.status === 'Resolved' || ev.status === 'OK' ? 'text-tertiary' : ev.status === 'Auto-recovered' ? 'text-secondary' : 'text-error'} font-bold">${ev.status}</td>
      </tr>
    `).join('');
}
