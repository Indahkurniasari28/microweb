# MICROWAT IoT System - ESP32 Setup Guide

## Overview
Sistem IoT MICROWAT untuk monitoring sensor ultrasonic (HC-SR04) dan sensor hujan menggunakan ESP32 DevKit dengan komunikasi MQTT.

---

## 📋 Hardware Requirements

### Komponen:
- **1x ESP32 DevKit** (dengan WiFi & Bluetooth)
- **1x Sensor Ultrasonic HC-SR04** (untuk mengukur jarak)
- **1x Rain Sensor Module** (analog output)
- **USB Cable** (untuk programming)
- **Jumper wires** (untuk koneksi)
- **Breadboard** (opsional)

### Pin Configuration:

```
ESP32 Pin Layout:
┌─────────────────────────────────────┐
│          ESP32 DevKit               │
│                                     │
│ GND  -> HC-SR04 GND                 │
│ VCC (3.3V) -> HC-SR04 VCC           │
│ GPIO 12 -> HC-SR04 TRIG             │
│ GPIO 14 -> HC-SR04 ECHO             │
│                                     │
│ GND  -> Rain Sensor GND             │
│ VCC (3.3V) -> Rain Sensor + (VCC)   │
│ GPIO 36 -> Rain Sensor AO (analog)  │
│                                     │
│ GPIO 2 -> LED (status indicator)    │
│                                     │
└─────────────────────────────────────┘
```

### Wiring Diagram:

**HC-SR04 Ultrasonic Sensor:**
```
HC-SR04:
  VCC  -----> ESP32 3.3V
  GND  -----> ESP32 GND
  TRIG -----> ESP32 GPIO 12
  ECHO -----> ESP32 GPIO 14
```

**Rain Sensor:**
```
Rain Sensor Module:
  + / VCC  -----> ESP32 3.3V
  - / GND  -----> ESP32 GND
  AO / Signal -> ESP32 GPIO 36 (ADC input)
```

**LED Status:**
```
LED:
  + (Anode) -----> ESP32 GPIO 2 (with 220Ω resistor)
  - (Cathode) --> ESP32 GND
```

---

## 🔧 Arduino IDE Setup

### 1. Install Arduino IDE
- Download dari: https://www.arduino.cc/en/software

### 2. Add ESP32 Board Support
- **Preferences** → **Additional Boards Manager URLs**
- Tambahkan: `https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json`
- **Tools** → **Board** → **Board Manager**
- Cari "esp32" dan Install

### 3. Select ESP32 Board
- **Tools** → **Board** → **ESP32 Dev Module**
- **Tools** → **Port** → Select COM port (USB)

### 4. Install Required Libraries
Di **Sketch** → **Include Library** → **Manage Libraries**, cari dan install:
- `PubSubClient` (untuk MQTT)
- `WiFi` (built-in)

---

## 📝 Upload Code

1. **Copy file `esp32_iot_sensor.ino`** dari project root
2. **Open di Arduino IDE**
3. **Update konfigurasi jika perlu:**
   ```cpp
   const char* MQTT_SERVER = "192.168.1.100";  // Ganti dengan IP server Anda
   ```
4. **Verify** (Ctrl + Alt + U)
5. **Upload** (Ctrl + U)

### Default WiFi & MQTT Config:
```cpp
WiFi SSID: UBINNMASJIDD
WiFi Password: namalengkapgua
MQTT Server: localhost:1883 (local)
MQTT Topic: esp32/sensors
```

---

## 🌐 Server Setup

### 1. Install MQTT Broker (Mosquitto)

**Windows:**
```cmd
# Download installer dari: https://mosquitto.org/download/
# Atau gunakan WSL:
wsl sudo apt-get install mosquitto mosquitto-clients
wsl sudo service mosquitto start
```

**Linux:**
```bash
sudo apt-get install mosquitto mosquitto-clients
sudo systemctl start mosquitto
sudo systemctl enable mosquitto
```

### 2. Start Node.js Server
```bash
cd d:\all code\iot
npm install  # Install dependencies jika belum
npm start    # Start server di port 3000
```

### 3. Verify MQTT Connection
```bash
# Di terminal separate, test MQTT:
mosquitto_sub -h localhost -t "esp32/sensors"

# Seharusnya menerima data dari ESP32 dalam format JSON
```

---

## 🚀 Testing & Monitoring

### 1. Serial Monitor (Arduino IDE)
- **Tools** → **Serial Monitor** (Baud 115200)
- Lihat debug messages dari ESP32

### 2. Browser Dashboard
- Buka: http://localhost:3000
- Login dengan: test@example.com / 123456
- Lihat real-time sensor data

### 3. Sensor Status Indicators

**Ultrasonic Distance:**
- 5-50 cm  → **DEKAT**
- 50-200 cm → **JAUH**
- Luar range → Out of range

**Rain Sensor:**
- Analog value > 2000 → **BASAH**
- Analog value ≤ 2000 → **KERING**
- *(Adjust threshold sesuai kalibrasi)*

---

## 📊 MQTT Message Format

ESP32 mengirim data setiap 2 detik dalam format JSON:

```json
{
  "timestamp": "12:34:56",
  "ultrasonic_distance": 25.5,
  "ultrasonic_status": "DEKAT",
  "rain_sensor": "BASAH",
  "esp_status": "ONLINE",
  "wifi_ssid": "UBINNMASJIDD",
  "wifi_rssi": -45,
  "mqtt_connected": true
}
```

Topic: `esp32/sensors`

---

## 🔍 Troubleshooting

### ESP32 tidak connect ke WiFi
- ✓ Pastikan WiFi SSID & password benar
- ✓ Check jarak dari WiFi router
- ✓ Restart ESP32 (tekan RESET button)

### MQTT connect failed
- ✓ Verify mosquitto service running: `mosquitto -v`
- ✓ Check firewall (port 1883)
- ✓ Verify IP address di code (`MQTT_SERVER`)

### Sensor data tidak terukur
- ✓ Check wiring (pin GPIO sesuai)
- ✓ Verify sensor power supply (3.3V)
- ✓ Test sensor dengan contoh code terpisah

### Data tidak muncul di browser
- ✓ Check MQTT messages: `mosquitto_sub -h localhost -t "#"`
- ✓ Verify Socket.io connection di browser (F12 Console)
- ✓ Check server logs

---

## 🔐 Security Notes

- ⚠️ Default WiFi password terbuka untuk demo
- ⚠️ MQTT tanpa authentication (local only)
- ✅ Use password manager untuk WiFi di production
- ✅ Setup MQTT username/password di mosquitto.conf

---

## 📞 Support

Jika ada error, cek:
1. **Serial Monitor** (Arduino IDE) untuk debug messages
2. **Browser Console** (F12) untuk JavaScript errors
3. **Server Console** untuk Node.js logs
4. **mosquitto_sub** untuk MQTT message verification

---

## ✅ Checklist

- [ ] ESP32 board installed di Arduino IDE
- [ ] Libraries (PubSubClient) installed
- [ ] Code uploaded to ESP32
- [ ] MQTT Broker (mosquitto) running
- [ ] Node.js server running
- [ ] WiFi connected
- [ ] MQTT connected
- [ ] Sensor data visible di browser

---

**Happy IoT-ing!** 🎉
