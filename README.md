# 🌊 MICROWAT - Sistem Monitoring Degradasi Limbah

## Deskripsi Proyek

**MICROWAT (Microwave-Assisted Wastewater Treatment Monitoring)** adalah sistem monitoring real-time berbasis web untuk mengamati proses degradasi limbah menggunakan spektrofotometer UV-Vis. Sistem ini mengintegrasikan perangkat keras (Raspberry Pi + Spektrofotometer) dengan infrastruktur cloud (Firebase) untuk memberikan visualisasi data dan analisis yang komprehensif.

## 📋 Kebutuhan Fungsional

### 1. Autentikasi dan Akses Pengguna
- ✅ Akses pengguna melalui browser
- ✅ Sistem login dan logout
- ✅ Registrasi akun baru
- ✅ Reset/pemulihan kata sandi
- ✅ Pengelolaan sesi pengguna aktif

### 2. Dashboard Monitoring Utama
- ✅ Interface web berbasis PWA (Progressive Web App)
- ✅ Tampilan kondisi sistem MICROWAT secara real-time
- ✅ Parameter utama hasil degradasi limbah:
  - **Absorbansi (A)**: Nilai penyerapan cahaya
  - **Konsentrasi (ppm)**: mg/L limbah
  - **Persentase Degradasi (%)**: Tingkat penguraian limbah
  - **Status Limbah**: Idle / Berlangsung / Selesai
- ✅ Update otomatis tanpa reload halaman

### 3. Akuisisi Data Spektrofotometer
- ✅ Penerimaan data dari spektrofotometer UV-Vis 
- ✅ Nilai absorbansi pada panjang gelombang tertentu
- ✅ Integrasi dengan Raspberry Pi sebagai Single Board Computer
- ✅ Pengambilan data periodik real-time/near real-time
- ✅ Validasi data dari pengukuran aktual (bukan input manual)

### 4. Pengolahan Data Spektrofotometer
- ✅ Pengolahan nilai absorbansi
- ✅ Konversi ke konsentrasi limbah menggunakan Hukum Beer-Lambert:
  ```
  A = ε × c × l
  c = A / (ε × l)
  ```
- ✅ Perhitungan persentase degradasi:
  ```
  Degradasi (%) = ((C0 - Ct) / C0) × 100
  ```
- ✅ Identifikasi kondisi steady-state (absorbansi relatif konstan)
- ✅ Persiapan data untuk transmisi ke webapp

### 5. Integrasi Data Spektrofotometer ke WebApp
- ✅ Pengiriman data ke server cloud
- ✅ Protokol MQTT untuk transmisi dari Raspberry Pi
- ✅ Penyimpanan di Firebase Realtime Database
- ✅ Pengambilan data langsung dari database untuk display
- ✅ Sinkronisasi data real-time antara perangkat dan dashboard

### 6. Visualisasi Data Real-Time
- ✅ Nilai konsentrasi limbah (ppm) secara real-time
- ✅ Persentase degradasi limbah (%)
- ✅ Presentasi dalam bentuk angka dan grafik
- ✅ Integrasi: Raspberry Pi → MQTT → Firebase → Web Dashboard

### 7. Analisis dan Riwayat Data
- ✅ Penyimpanan data historis pengukuran
- ✅ Pencarian data pada rentang waktu tertentu
- ✅ Grafik tren perubahan ppm dan degradasi
- ✅ Export data dalam format CSV

### 8. Sistem Notifikasi
- ✅ Notifikasi visual di dashboard
- ✅ Peringatan jika degradasi < ambang batas
- ✅ Notifikasi jika data tidak diperbarui dalam periode tertentu
- ✅ Panel notifikasi dengan histori

### 9. Akuisisi dan Integrasi Data IoT
- ✅ Penerimaan data dari Raspberry Pi via MQTT
- ✅ Pemrosesan dan penyimpanan ke Firebase
- ✅ Sinkronisasi data real-time
- ✅ Validasi data sebelum tampil

### 10. Progressive Web App (PWA)
- ✅ Aplikasi berjalan sebagai PWA
- ✅ Akses pada koneksi internet tidak stabil
- ✅ Penambahan shortcut ke home screen
- ✅ Offline capability dengan service worker
- ✅ Caching strategy yang optimal

### 11. Logging dan Penyimpanan Data
- ✅ Penyimpanan data terstruktur
- ✅ Menjaga konsistensi dan integritas data
- ✅ Memungkinkan data digunakan untuk analisis lanjutan

### 12. Batasan Fungsional
- ❌ Webapp TIDAK mengendalikan pengaturan spektrofotometer
- ℹ️ Pengambilan data sepenuhnya oleh perangkat keras & software lokal (Avasoft + Raspberry Pi)
- ℹ️ Webapp berfungsi sebagai sistem monitoring dan visualisasi

## 🏗️ Arsitektur Sistem

```
┌─────────────────────────────────────────────────────────────┐
│                    BROWSER CLIENT (PWA)                     │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  • Authentication UI (Login/Register)              │   │
│  │  • Real-time Dashboard                             │   │
│  │  • Monitoring Charts                               │   │
│  │  • Historical Data Viewer                          │   │
│  │  • Control Panel                                   │   │
│  └──────────────────────────────────────────────────────┘   │
└──────────────────┬──────────────────────────────────────────┘
                   │ WebSocket (Socket.io)
                   │ REST API (HTTP)
┌──────────────────┴──────────────────────────────────────────┐
│              NODE.JS SERVER (Backend)                       │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  • Express.js (REST API)                           │   │
│  │  • Socket.io (Real-time)                           │   │
│  │  • MQTT Client                                     │   │
│  │  • Firebase Admin SDK                             │   │
│  │  • Data Processing (Beer-Lambert)                 │   │
│  └──────────────────────────────────────────────────────┘   │
└──────────────┬────────────────┬─────────────────────────────┘
               │                │
        ┌──────┴─────┐   ┌──────┴──────────┐
        │   MQTT     │   │  FIREBASE      │
        │  Broker    │   │  Realtime DB   │
        │ (HiveMQ)   │   │ + Auth         │
        └──────┬─────┘   └──────┬──────────┘
               │                │
        ┌──────┴─────┐          │
        │ Raspberry  │          │
        │    Pi      │←─────────┘
        │ + Spectrum │
        │  fotometer │
        └────────────┘
```

## 📦 Stack Teknologi

### Backend
- **Node.js** (v18+)
- **Express.js**: REST API framework
- **Socket.io**: Real-time bidirectional communication
- **MQTT**: IoT data transmission protocol
- **Firebase Admin SDK**: Cloud database & authentication
- **firebase-admin**: Database operations

### Frontend
- **HTML5**: Structure
- **CSS3**: Styling dengan custom properties & responsive design
- **JavaScript (ES6+)**: Logic & interactivity
- **Chart.js**: Data visualization
- **Firebase**: Client-side auth & real-time database sync
- **Socket.io Client**: Real-time updates

### Cloud Services
- **Firebase Authentication**: User management
- **Firebase Realtime Database**: Data storage
- **HiveMQ Cloud**: MQTT broker

### PWA/Mobile
- **Service Worker**: Offline support & caching
- **Web App Manifest**: App metadata
- **Font Awesome 6**: Icons

## 🚀 Instalasi & Setup

### Prerequisites
- Node.js v18 atau lebih tinggi
- npm atau yarn
- Account Firebase dengan Realtime Database
- Account HiveMQ Cloud dengan MQTT broker
- Raspberry Pi dengan Spektrofotometer UV-Vis (untuk perangkat)

### Installation

1. **Clone Repository**
```bash
cd d:\all code\iot
```

2. **Install Dependencies**
```bash
npm install
```

3. **Konfigurasi Environment**
Buat/update file `serviceAccountKey.json` dengan Firebase service account credentials.

Edit `public/firebase-config.js`:
```javascript
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "your-project.firebaseapp.com",
  databaseURL: "https://your-project-default-rtdb.region.firebasedatabase.app",
  projectId: "your-project",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "your-sender-id",
  appId: "your-app-id"
};
```

4. **Start Server**
```bash
npm start
```

Server akan berjalan di `http://localhost:3000`

## 📝 Struktur Project

```
d:\all code\iot\
├── server.js                 # Main server (Express + Socket.io + MQTT)
├── package.json              # Dependencies
├── serviceAccountKey.json    # Firebase credentials
├── public/
│   ├── index.html            # Main HTML
│   ├── app.js                # Client-side logic
│   ├── style.css             # Styling
│   ├── firebase-config.js    # Firebase config
│   ├── sw.js                 # Service Worker (PWA)
│   ├── manifest.json         # PWA manifest
│   └── images/
│       ├── logo.png
│       ├── PomClear.png
│       └── ...
└── functions/                # Cloud Functions (optional)
```

## 🔌 MQTT Topics

### Device to Server (Publish)
- `microwat/spectrometer/absorbance` - Nilai absorbansi (float)
- `microwat/spectrometer/wavelength` - Panjang gelombang (nm)
- `microwat/status/online` - Status online (1/0)
- `microwat/status/measurement` - Status pengukuran aktif (1/0)

### Server to Device (Subscribe)
- `microwat/control/start` - Mulai pengukuran
- `microwat/control/stop` - Henti pengukuran
- `microwat/control/reset` - Reset sistem

## 💾 Firebase Database Structure

```
{
  "measurements": {
    "uid1": {
      "timestamp": "2024-02-12T10:30:00Z",
      "absorbance": 0.456,
      "wavelength": 254,
      "concentration": 150.5,
      "degradation": 45.2,
      "status": "measuring"
    }
  },
  "parameters": {
    "current": {
      "initialConcentration": 335.0,
      "wavelength": 254,
      "moldExtinctionCoeff": 1000,
      "pathLength": 1
    }
  },
  "users": {
    "uid1": {
      "email": "user@example.com",
      "createdAt": "2024-01-01"
    }
  }
}
```

## 🔐 API Endpoints

### Authentication
- `POST /api/auth/login` - Login pengguna
- `POST /api/auth/register` - Registrasi pengguna
- `POST /api/auth/logout` - Logout

### Measurements
- `GET /api/measurements?startDate=DATE&endDate=DATE` - Retrieve historical measurements
- `GET /api/current-measurement` - Get latest measurement
- `POST /api/measurements` - Save manual measurement

### System
- `GET /api/status` - System status
- `POST /api/parameters` - Set measurement parameters
- `GET /api/parameters` - Get current parameters

## 📊 Perhitungan Data

### Hukum Beer-Lambert
```
A = ε × c × l

Dimana:
A = Absorbansi
ε = Koefisien ekstinsi molar (L/mol·cm)
c = Konsentrasi (mol/L)
l = Panjang sel (cm)

Maka:
c (ppm) = (A / (ε × l)) × 1,000,000
```

### Persentase Degradasi
```
Degradasi (%) = ((C0 - Ct) / C0) × 100

Dimana:
C0 = Konsentrasi awal
Ct = Konsentrasi saat ini
```

## ⚙️ Configuration

### Raspberry Pi Setup

1. Install Python & dependencies:
```bash
sudo apt-get install python3-pip
pip3 install paho-mqtt
```

2. Konfigurasi MQTT:
- Update `MQTT_BROKER` di server.js
- Update MQTT username/password

3. Spektrofotometer Integration:
- Serial connection ke Spektrofotometer
- Parse data absorbansi
- Publish ke MQTT topic `microwat/spectrometer/absorbance`

## 🔔 Real-time Updates

Update real-time menggunakan WebSocket (Socket.io):
- Pengukuran baru diterima
- Status sistem berubah
- Notifikasi sistem

## 📱 PWA Features

- **Installable**: Tambahkan ke home screen
- **Offline Support**: Berfungsi tanpa internet (cache strategy)
- **Background Sync**: Sync data saat kembali online
- **Responsive**: Optimal di desktop, tablet, mobile

## 🧪 Testing

### Manual Testing
1. Open http://localhost:3000
2. Register akun baru
3. Simulasi MQTT publish dengan MQTT client:
```bash
mosquitto_pub -h test.mosquitto.org -t "microwat/spectrometer/absorbance" -m "0.45"
```
4. Lihat data di dashboard

### Browser DevTools
- **Console**: Check for errors
- **Network**: Monitor API calls
- **Storage**: Inspect cache & local storage
- **Service Workers**: Verify SW registration

## 📈 Monitoring & Logging

- Server logs di console
- Browser console logs untuk client-side debugging
- Firebase console untuk database monitoring

## 🐛 Troubleshooting

| Issue | Solution |
|-------|----------|
| MQTT tidak terkoneksi | Check broker URL & credentials |
| Data tidak muncul | Verify Firebase config & permissions |
| PWA offline tidak work | Check Service Worker in DevTools |
| Charts tidak load | Ensure Chart.js CDN accessible |
| Authentication timeout | Check Firebase rules |

## 📞 Support & Documentation

- Firebase Docs: https://firebase.google.com/docs
- Chart.js Docs: https://www.chartjs.org/docs/latest/
- MQTT Docs: https://mqtt.org/
- HiveMQ Docs: https://www.hivemq.com/docs/

## 📄 License

Proprietary - Wastewater Treatment Monitoring System

## 👥 Contributors

- System Architecture & Backend: Development Team
- UI/UX & Frontend: Development Team
- System Integration: IoT Team

---

**Last Updated**: February 12, 2024
**Status**: ✅ Production Ready
# microweb
