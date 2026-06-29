# 🚀 MICROWAT - Quick Start Guide

## 5-Minute Setup

### 1. Persiapan Awal

```bash
# Navigate to project
cd d:\all code\iot

# Install dependencies
npm install

# Check Node version (should be >= 18)
node --version
```

### 2. Konfigurasi Firebase

**Update `public/firebase-config.js`:**
```javascript
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "your-project.firebaseapp.com",
  databaseURL: "https://your-project-rtdb.region.firebasedatabase.app",
  projectId: "your-project",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};
```

**Pastikan `serviceAccountKey.json` ada di root:**
- Download dari Firebase Console → Project Settings → Service Accounts
- Rename ke `serviceAccountKey.json`

### 3. Mulai Server

```bash
npm start
```

Output akan seperti:
```
✅ Firebase Admin SDK initialized
✅ Connected to MQTT Broker (MICROWAT)
📡 Subscribed to MICROWAT topics
🚀 MICROWAT Server running on port 3000
```

### 4. Akses Application

- **URL**: http://localhost:3000
- **Mobile**: http://[your-ip]:3000

### 5. Registrasi & Login

1. Klik "Daftar Akun"
2. Masukkan email dan password
3. Klik "Daftar"
4. Akan otomatis login

---

## 📊 Test dengan Data Dummy

### Option 1: Simulated MQTT Data

Buka browser console dan jalankan:

```javascript
// Simulate real measurement
async function simulateMeasurement() {
  const absorbance = Math.random() * 0.8; // 0 - 0.8
  const initialC = 335; // ppm
  const currentC = initialC * (1 - Math.random() * 0.5); // 0-50% degradation
  
  const response = await fetch('/api/measurements', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      absorbance,
      wavelength: 254,
      initialConcentration: initialC
    })
  });
  
  const data = await response.json();
  console.log('✅ Measurement saved:', data);
}

// Run simulation every 5 seconds
setInterval(simulateMeasurement, 5000);

// Or run once
simulateMeasurement();
```

### Option 2: Use MQTT Client

**Install mosquitto-clients:**
```bash
# Linux
sudo apt-get install mosquitto-clients

# Windows - Download from https://mosquitto.org/download/
```

**Publish test data:**
```bash
# Test MQTT connectivity
mosquitto_pub -h d089792bed824fa48635d8ef188c6799.s1.eu.hivemq.cloud \
  -p 8884 \
  -u pomclear \
  -P Pomclear123 \
  -t "microwat/spectrometer/absorbance" \
  -m "0.456" \
  --cafile CA.crt \
  -d
```

---

## 🎯 Key Pages

### 1. **Dashboard** (Default)
- Real-time measurements
- System status
- Quick action buttons
- Live charts
- Alerts

### 2. **Monitoring**
- Parameter trends
- Latest measurement details

### 3. **Riwayat (History)**
- Table of all measurements
- Date range filter
- Export to CSV

### 4. **Kontrol (Controls)**
- Start/Stop measurement
- Parameter settings
- Beer-Lambert coefficients

### 5. **Pengaturan (Settings)**
- User email
- Notifications toggle
- App info

---

## 🔌 Real MQTT Setup

### Connect Raspberry Pi

**Python script for Raspberry Pi (`measure.py`):**

```python
import paho.mqtt.client as mqtt
import time
import serial
from datetime import datetime

# MQTT Config
BROKER = "d089792bed824fa48635d8ef188c6799.s1.eu.hivemq.cloud"
PORT = 8884
USER = "pomclear"
PASSWORD = "Pomclear123"
TOPIC = "microwat/spectrometer/absorbance"

# Serial Config for Spectrometer
SERIAL_PORT = "/dev/ttyUSB0"
BAUDRATE = 115200

def on_connect(client, userdata, flags, rc):
    print("Connected to MQTT Broker" if rc == 0 else f"Failed: {rc}")

def on_disconnect(client, userdata, rc):
    print("Disconnected from MQTT Broker")

def read_spectrometer():
    """Read absorbance from spectrometer"""
    try:
        ser = serial.Serial(SERIAL_PORT, BAUDRATE, timeout=1)
        # Send command to spectrometer (adjust based on actual device)
        ser.write(b"GET_ABS\n")
        response = ser.readline().decode('utf-8').strip()
        ser.close()
        return float(response)
    except Exception as e:
        print(f"Error reading spectrometer: {e}")
        return None

# Create MQTT client
client = mqtt.Client("RaspberryPi_Spectrometer")
client.on_connect = on_connect
client.on_disconnect = on_disconnect
client.username_pw_set(USER, PASSWORD)

# Connect
client.connect(BROKER, PORT, keepalive=60)

# Measurement loop
client.loop_start()

try:
    print("Starting measurement loop...")
    while True:
        absorbance = read_spectrometer()
        if absorbance is not None:
            timestamp = datetime.now().isoformat()
            print(f"[{timestamp}] Absorbance: {absorbance:.3f}")
            client.publish(TOPIC, absorbance)
        time.sleep(1)  # Read every 1 second
except KeyboardInterrupt:
    print("\nStopping...")
finally:
    client.loop_stop()
    client.disconnect()
```

**Install dependencies:**
```bash
pip3 install paho-mqtt pyserial
python3 measure.py
```

---

## 📱 PWA Installation

### Desktop
1. Open http://localhost:3000
2. Click install button (top-right)
3. Add to desktop/applications

### Mobile
1. Open http://[ip]:3000 on mobile
2. Tap "Add to Home Screen"
3. Launch from home screen

### Offline Usage
1. Open DevTools → Application
2. Check "Offline"
3. App should still work with cached data

---

## 🐛 Common Issues & Solutions

### MQTT Connection Failed
```
❌ Solution:
1. Check MQTT broker URL/credentials
2. Update in server.js
3. Check firewall/network
```

### Firebase Connection Error
```
❌ Solution:
1. Verify serviceAccountKey.json exists
2. Check Firebase project ID matches
3. Enable Realtime Database rules
```

### Charts Not Showing
```
❌ Solution:
1. Check Chart.js CDN is accessible
2. Verify measurement data exists
3. Check browser console for errors
```

### Service Worker Not Registering
```
❌ Solution:
1. HTTPS required (except localhost)
2. Check DevTools → Application → SW
3. Clear cache and rebuild
```

---

## 🔍 Debugging

### Browser Console
```javascript
// Check Firebase connection
firebase.database().ref("/measurements").limitToLast(1).once("value", 
  snap => console.log("✅ Connected to Firebase"));

// Check WebSocket
console.log(socket.connected ? "Connected" : "Disconnected");

// Test measurement
simulateMeasurement();
```

### Server Console
The following logs indicate proper operation:
```
✅ Connected to MQTT Broker
📡 Subscribed to MICROWAT topics
🔌 WebSocket client connected
📥 [timestamp] topic: value
✅ Data saved to Firebase
📤 Published to topic: message
```

### Firebase Console
1. Go to Firebase Console
2. Select "Realtime Database"
3. Check `/measurements` node
4. Verify data structure and timestamps

---

## 📈 Monitoring Dashboard

### Key Metrics
- **Absorbance (A)**: Should change 0-1.0 range
- **Concentration (ppm)**: Depends on Beer-Lambert coeff
- **Degradation (%)**: Should increase over time (0→100%)
- **Status**: IDLE → BERLANGSUNG → SELESAI

### Healthy System Indicators
- ✅ Data updates every 1-5 seconds
- ✅ Degradation increases monotonically
- ✅ No WebSocket disconnection warnings
- ✅ Firebase write operations < 100ms

---

## 📊 Data Analysis

### Export History
1. Go to "Riwayat" (History)
2. Select date range
3. Click "Export CSV"
4. Open in Excel/Sheets

### CSV Format
```
Waktu,Absorbansi,Konsentrasi (ppm),Degradasi (%),Status
2024-02-12T10:30:00Z,0.456,150.5,45.2,measuring
2024-02-12T10:31:00Z,0.398,132.1,60.5,measuring
2024-02-12T10:32:00Z,0.320,106.3,68.2,measuring
```

---

## 🎓 Learning Resources

### Understanding Beer-Lambert Law
- **Formula**: A = ε × c × l
- **Where**:
  - A = Absorbance (0-4.0)
  - ε = Molar extinction coefficient (L/mol·cm)
  - c = Concentration (mol/L)
  - l = Path length (cm, usually 1)

### Degradation Calculation
- **Formula**: Deg(%) = ((C₀ - Cₜ) / C₀) × 100
- **Interpretation**:
  - 0% = No degradation
  - 50% = Half degraded
  - 100% = Completely degraded

### Firebase Realtime Database
- [Official Docs](https://firebase.google.com/docs/database)
- Real-time sync across clients
- JSON-based structure

### Socket.io Real-time
- [Socket.io Docs](https://socket.io/docs/)
- Event-based bidirectional communication
- Automatic fallbacks

---

## ✅ Verification Checklist

After startup, verify:

- [ ] Server outputs: "MICROWAT Server running on port 3000"
- [ ] Firebase connection: "✅ Firebase Admin SDK initialized"
- [ ] MQTT connection: "✅ Connected to MQTT Broker"
- [ ] Can access http://localhost:3000
- [ ] Can register/login
- [ ] Can see dashboard with sample data
- [ ] Can navigate between pages
- [ ] Charts render without errors
- [ ] PWA manifest loads: DevTools → Manifest tab

---

## 🚀 Next Steps

1. **Production Deployment**
   - Deploy to Heroku/Railway/Cloud Run
   - Enable HTTPS
   - Configure SSL certificate

2. **Hardware Integration**
   - Connect Raspberry Pi
   - Configure Avasoft
   - Test MQTT link

3. **Advanced Features**
   - Machine learning predictions
   - Automated sample collection
   - Email alerts
   - Database backups

4. **Security Hardening**
   - Firebase security rules
   - API rate limiting
   - Input validation

---

## 📞 Support

**Documentation**: See README.md  
**Technical Details**: See IMPLEMENTATION.md  
**Issues**: Check Browser Console & Server Logs

---

**Happy Monitoring! 🌊**
