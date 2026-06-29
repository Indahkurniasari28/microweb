# MICROWAT - Technical Implementation Guide

## 📋 Implementasi Kebutuhan Fungsional

### 1. Autentikasi dan Akses Pengguna ✅

**File**: `public/app.js`  
**Implementasi**:

```javascript
// Firebase Auth Integration
auth = firebase.auth();

// Login
await auth.signInWithEmailAndPassword(email, password);

// Register
await auth.createUserWithEmailAndPassword(email, password);

// Reset Password
await auth.sendPasswordResetEmail(email);

// Logout
await auth.signOut();
```

**Features**:
- Session management via Firebase Auth
- Token-based authentication
- Automatic login state monitoring

**Testing**:
1. Registrasi akun baru
2. Login dengan email/password
3. Reset password via email
4. Logout dan refresh page (harus redirect ke login)

---

### 2. Dashboard Monitoring Utama ✅

**File**: `public/index.html`, `public/style.css`  
**Implementasi**:

- **Real-time Update**: Socket.io connection
- **PWA Interface**: Manifest.json + Service Worker
- **Dashboard Cards**: 
  - Primary Measurements (Absorbansi, Konsentrasi, Degradasi)
  - System Status (Hardware, Measuring, MQTT, Last Update)
  - Quick Actions (Start/Stop/Refresh)
  - Real-time Charts

**Testing**:
1. Buka dashboard setelah login
2. Simulasi data dari MQTT untuk melihat update real-time
3. Ubah tema untuk responsive testing
4. Check offline mode (devtools > offline)

---

### 3. Akuisisi Data Spektrofotometer ✅

**File**: `server.js`  
**Implementasi**:

```javascript
// MQTT Topics
const topics = [
  "microwat/spectrometer/absorbance",
  "microwat/spectrometer/wavelength",
  "microwat/status/online",
  "microwat/status/measurement"
];

// Message Handler
mqttClient.on("message", (topic, message) => {
  if (topic === "microwat/spectrometer/absorbance") {
    latestMeasurement.absorbance = parseFloat(message.toString());
    calculateAndStore(latestMeasurement);
    io.emit("spectrometerUpdate", latestMeasurement);
  }
});
```

**Integration Points**:
- Raspberry Pi publishes absorbansi values
- Server receives via MQTT
- Broadcasts to web clients via Socket.io

**Real-device Testing**:
```bash
# From Raspberry Pi or MQTT client
mosquitto_pub -h [BROKER_URL] -u [USER] -P [PASS] \
  -t "microwat/spectrometer/absorbance" -m "0.456"
```

---

### 4. Pengolahan Data Spektrofotometer ✅

**File**: `server.js`, `public/app.js`  
**Implementasi**:

```javascript
// Beer-Lambert Law Calculation
function calculateConcentrationFromAbsorbance(absorbance, 
    moldExtinctionCoeff = 1000, pathLength = 1) {
  if (!absorbance || absorbance <= 0) return 0;
  return (absorbance / (moldExtinctionCoeff * pathLength)) * 1000; // ppm
}

// Degradation Percentage
function calculateDegradationPercentage(initialConcentration, 
    currentConcentration) {
  if (!initialConcentration || initialConcentration === 0) return 0;
  const degradation = ((initialConcentration - currentConcentration) / 
    initialConcentration) * 100;
  return Math.max(0, Math.min(100, degradation));
}

// Steady-state Detection
function isSteadyState(measurements, threshold = 0.05) {
  if (measurements.length < 5) return false;
  const recent = measurements.slice(-5);
  const avg = recent.reduce((a, b) => a + b, 0) / recent.length;
  return recent.every(val => Math.abs(val - avg) < threshold);
}
```

**Validation**:
- Absorbansi range: 0 - 4.0
- Konsentrasi harus positif
- Degradasi capped 0-100%

---

### 5. Integrasi Data ke WebApp ✅

**File**: `server.js`  
**Implementasi**:

```javascript
// MQTT → Firebase → WebSocket Chain
mqttClient.on("message", async (topic, message) => {
  // 1. Process data
  calculateAndStore(measurement);
  
  // 2. Save to Firebase
  const ref = db.ref("measurements").push();
  await ref.set(measurement);
  
  // 3. Broadcast to WebSocket clients
  io.emit("spectrometerUpdate", measurement);
});

// Real-time sync
io.on('connection', (socket) => {
  socket.emit('currentMeasurement', latestMeasurement);
});
```

**Data Flow**:
```
Raspberry Pi (MQTT Publish) 
  → HiveMQ Broker 
  → Node.js Server (MQTT Subscribe)
  → Firebase Realtime DB (Save)
  → WebSocket Broadcast
  → Web Browser (Socket.io Listen)
```

---

### 6. Visualisasi Data Real-Time ✅

**File**: `public/app.js`, `public/index.html`  
**Implementasi**:

```javascript
// Chart.js Integration
function initializeRealtimeChart() {
  const ctx = document.getElementById('realtimeChart').getContext('2d');
  chartInstances.realtime = new Chart(ctx, {
    type: 'line',
    data: {
      labels: [],
      datasets: [
        {
          label: 'Konsentrasi (ppm)',
          data: [],
          borderColor: '#2196F3',
          tension: 0.4
        },
        {
          label: 'Degradasi (%)',
          data: [],
          borderColor: '#4CAF50',
          tension: 0.4,
          yAxisID: 'y1'
        }
      ]
    },
    options: {
      responsive: true,
      scales: {
        y: { position: 'left' },
        y1: { position: 'right', max: 100 }
      }
    }
  });
}

// Update on new data
socket.on('spectrometerUpdate', data => {
  updateRealtimeChart(data);
});
```

**Metrics Displayed**:
- Absorbansi (A) - 3 decimal places
- Konsentrasi (ppm) - 2 decimal places
- Degradasi (%) - 1 decimal place
- Timestamp (updated real-time)

---

### 7. Analisis & Riwayat Data ✅

**File**: `public/app.js`  
**Implementasi**:

```javascript
// Load Historical Data
async function loadMeasurementsHistory() {
  const response = await fetch('/api/measurements?days=7');
  const data = await response.json();
  measurementHistory = data.sort((a, b) => 
    new Date(a.timestamp) - new Date(b.timestamp)
  );
}

// Filter by Date Range
function loadHistoryTable() {
  const fromDate = document.getElementById('history-date-from').value;
  const toDate = document.getElementById('history-date-to').value;
  
  let filtered = measurementHistory.filter(m => {
    const date = new Date(m.timestamp).toISOString().split('T')[0];
    if (fromDate && date < fromDate) return false;
    if (toDate && date > toDate) return false;
    return true;
  });
  
  // Populate table
  displayHistoryInTable(filtered);
}

// Export to CSV
function exportHistoryCSV() {
  let csv = 'Waktu,Absorbansi,Konsentrasi (ppm),Degradasi (%),Status\n';
  measurementHistory.forEach(m => {
    csv += `"${m.timestamp}",${m.absorbance},${m.concentration},${m.degradation},"${m.status}"\n`;
  });
  
  const blob = new Blob([csv], { type: 'text/csv' });
  downloadBlob(blob, 'microwat-data.csv');
}
```

---

### 8. Sistem Notifikasi ✅

**File**: `public/app.js`  
**Implementasi**:

```javascript
// Add Notification
function addNotification(message, type = 'info') {
  const notification = {
    id: Date.now(),
    message,
    type,
    timestamp: new Date().toLocaleTimeString('id-ID')
  };
  
  notifications.unshift(notification);
  updateNotificationPanel();
  
  // Auto-remove after 5 seconds
  setTimeout(() => {
    notifications = notifications.filter(n => n.id !== notification.id);
  }, 5000);
}

// Trigger Notifications
socket.on('spectrometerUpdate', data => {
  addNotification('📊 Pengukuran baru diterima', 'info');
  
  // Alert if degradation below threshold
  if (data.degradation > 0 && data.degradation < 10) {
    addNotification('⚠️ Degradasi < 10%', 'warning');
  }
});
```

**Notification Types**:
- Info (blue) - Data received
- Success (green) - Operation completed
- Warning (orange) - Warning alerts
- Error (red) - Error messages

---

### 9. Akuisisi & Integrasi Data IoT ✅

**File**: `server.js`  
**Implementasi**:

```javascript
// Data Validation
mqttClient.on('message', async (topic, message) => {
  const msgStr = message.toString();
  
  // Validate
  if (topic === 'microwat/spectrometer/absorbance') {
    const abs = parseFloat(msgStr);
    if (isNaN(abs) || abs < 0 || abs > 4.0) {
      console.error('Invalid absorbance:', abs);
      return;
    }
    
    // Store validated data
    latestMeasurement.absorbance = abs;
    await saveToFirebase(latestMeasurement);
    io.emit('spectrometerUpdate', latestMeasurement);
  }
});
```

---

### 10. Progressive Web App ✅

**Files**: 
- `public/manifest.json` - App metadata
- `public/sw.js` - Service Worker
- `public/index.html` - PWA meta tags

**Implementasi**:

```javascript
// Service Worker Registration
navigator.serviceWorker.register('/sw.js')
  .then(reg => console.log('SW registered'))
  .catch(err => console.error('SW registration failed'));

// Caching Strategy
self.addEventListener('fetch', event => {
  // Cache First for static assets
  if (isStaticAsset(event.request)) {
    event.respondWith(cacheFirst(event.request));
  }
  // Network First for API calls
  else if (isApiCall(event.request)) {
    event.respondWith(networkFirst(event.request));
  }
});
```

**PWA Capabilities**:
- ✅ Offline access with cached data
- ✅ Install to home screen
- ✅ Standalone mode
- ✅ Background sync
- ✅ Responsive design

**Testing PWA**:
1. DevTools → Application → Manifest
2. DevTools → Application → Service Workers
3. Install app: Menu → "Install MICROWAT"
4. Test offline: DevTools → Offline mode

---

### 11. Logging & Data Storage ✅

**File**: `server.js`  
**Implementasi**:

```javascript
// Firebase Structure
const measurement = {
  timestamp: new Date().toISOString(),
  absorbance: number,
  wavelength: number,
  concentration: number,
  degradation: number,
  status: string
};

// Save with async/await
async function calculateAndStore(measurement) {
  const ref = db.ref("measurements").push();
  await ref.set(measurement);
  console.log("✅ Data saved to Firebase");
}

// Data Consistency
// - Indexed by timestamp
// - User-scoped (if needed)
// - Automatic backups via Firebase
```

---

### 12. Batasan Fungsional ✅

**Webapp Functions**:
- ✓ Monitoring & visualization
- ✓ Historical data viewing
- ✓ User management
- ✓ Real-time alerts

**Webapp TIDAK**:
- ✗ Control spektrofotometer settings (hardware)
- ✗ Modify measurement algorithm (Avasoft)
- ✗ Change Raspberry Pi configuration

**Responsibility**:
- **Webapp**: Display & analyze data
- **Raspberry Pi**: Capture & transmit data
- **Avasoft**: Spectrometer control

---

## 🔄 Complete Data Flow

```
1. MEASUREMENT CAPTURE
   ├─ Avasoft (running on Raspberry Pi)
   ├─ Reads Spektrofotometer UV-Vis
   └─ Gets Absorbance value (A)

2. DATA TRANSMISSION
   ├─ Raspberry Pi MQTT Client
   ├─ Publishes: topic="microwat/spectrometer/absorbance", value=0.456
   └─ Sends to HiveMQ Broker

3. SERVER RECEPTION
   ├─ Node.js MQTT Client (connected to HiveMQ)
   ├─ Receives absorbance value
   └─ Triggers message event handler

4. DATA PROCESSING
   ├─ Beer-Lambert calculation: c = A / (ε × l) × 1,000,000
   ├─ Degradation calc: Deg = ((C0 - Ct) / C0) × 100
   ├─ Steady-state detection
   └─ Create measurement object

5. DATA STORAGE
   ├─ Save to Firebase Realtime DB
   ├─ Path: /measurements/{uid}/
   └─ Include: timestamp, all values, status

6. REAL-TIME BROADCAST
   ├─ Socket.io emit: 'spectrometerUpdate'
   ├─ Send: complete measurement object
   └─ To: all connected WebSocket clients

7. CLIENT DISPLAY
   ├─ Web browser receives update
   ├─ Update dashboard values
   ├─ Add to measurement history
   ├─ Update charts
   ├─ Trigger notifications
   └─ Store locally (IndexedDB)

8. HISTORICAL ACCESS
   ├─ User requests history page
   ├─ App calls: GET /api/measurements?startDate=X&endDate=Y
   ├─ Server retrieves from Firebase
   └─ Display in table with charts
```

---

## 🧪 Testing Checklist

### Unit Testing
- [ ] Beer-Lambert calculation correctness
- [ ] Degradation percentage calculation
- [ ] Steady-state detection logic
- [ ] Error handling for invalid inputs

### Integration Testing
- [ ] MQTT connection & subscription
- [ ] Firebase authentication
- [ ] WebSocket real-time updates
- [ ] Data persistence in Firebase

### System Testing
- [ ] End-to-end data flow Raspi → Browser
- [ ] Multiple user concurrent access
- [ ] Data sync consistency
- [ ] PWA offline functionality

### UI/UX Testing
- [ ] Responsive design (desktop/tablet/mobile)
- [ ] Chart rendering and updates
- [ ] Form validation
- [ ] Notification display

### Security Testing
- [ ] Firebase rules (read/write auth)
- [ ] MQTT credential protection
- [ ] Session management
- [ ] HTTPS enforcement

---

## 📊 Performance Optimization

### Database
- Limit historical queries (pagination)
- Index on timestamp for sorting
- Archive old data (> 6 months)

### Frontend
- Lazy load charts
- Debounce real-time updates (100ms)
- Compress images
- Minify CSS/JS

### Network
- Gzip compression
- CDN for static assets
- WebSocket compression
- API response caching

---

## 🚀 Deployment Checklist

- [ ] Firebase rules configured
- [ ] MQTT broker credentials set
- [ ] Service Worker tested
- [ ] HTTPS enabled
- [ ] Error monitoring setup
- [ ] Backup strategy configured
- [ ] Documentation complete

---

**Last Updated**: February 12, 2024
