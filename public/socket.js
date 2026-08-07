// ============================================================================
// MICROWAT - Socket.io
// ============================================================================

function initializeSocket() {
  if (typeof io === 'undefined') {
    console.error('❌ Socket.io not loaded');
    return;
  }

  socket = io();

  socket.on('connect', () => {
    console.log('✅ WebSocket connected');
    updateSystemStatus('mqtt', 'online');
    addNotification('✅ Terhubung ke server', 'success');
  });

  socket.on('disconnect', () => {
    console.log('❌ WebSocket disconnected');
    updateSystemStatus('mqtt', 'offline');
    addNotification('❌ Terputus dari server', 'error');
  });

  socket.on('spectrometerUpdate', data => {
    console.log('📊 Measurement received:', data);
    updateMeasurementDisplay(data);
    addMeasurementToHistory(data);
    updateCharts();
    addNotification('📊 Data pengukuran diperbarui', 'info');
  });

  socket.on('esp32Data', data => {
    console.log('[ESP32] Data received:', data);
    updateEsp32Display(data);
  });

  socket.on('measurementStarted', () => {
    addNotification('▶️ Pengukuran dimulai', 'info');
    updateMeasurementStatus('measuring');
  });

  socket.on('measurementStopped', () => {
    addNotification('⏹️ Pengukuran dihentikan', 'warning');
    updateMeasurementStatus('stopped');
  });

  socket.on('measurementReset', () => {
    addNotification('🔄 Data pengukuran direset', 'warning');
    updateMeasurementStatus('idle');
  });
}
