# Quick Start - ESP32 IoT System

## 🚀 3 Langkah Setup Cepat

### 1️⃣ Setup Mosquitto MQTT Broker (Local)

**Windows - Using WSL2:**
```powershell
# Buka PowerShell as Admin
wsl --install
wsl
sudo apt-get update
sudo apt-get install mosquitto mosquitto-clients
sudo systemctl start mosquitto
sudo systemctl enable mosquitto
```

**Windows - Direct Installation:**
- Download: https://mosquitto.org/download/
- Run installer
- MQTT akan running di localhost:1883

**Verify:**
```bash
mosquitto_sub -h localhost -t "#"
# Seharusnya connect tanpa error
```

---

### 2️⃣ Upload Arduino Code ke ESP32

1. Download Arduino IDE: https://www.arduino.cc/en/software
2. Add ESP32 board support (lihat ESP32_SETUP_GUIDE.md)
3. Open `esp32_iot_sensor.ino`
4. **PENTING:** Edit IP address:
   ```cpp
   const char* MQTT_SERVER = "192.168.1.100";  // Ganti dengan IP komputer Anda!
   ```
5. Upload ke ESP32

**Cara mendapat IP komputer:**
```cmd
ipconfig
# Cari IPv4 Address (biasanya 192.168.x.x)
```

---

### 3️⃣ Start Server & Lihat Data

```bash
cd d:\all code\iot
npm start
```

Buka browser: **http://localhost:3000**

- Login: `test@example.com` / `123456`
- Klik: **"Sensor Real"** di sidebar
- Lihat data dari ESP32 real-time! 🎉

---

##  ⚙️ Wiring Quick Reference

```
ESP32 DevKit     HC-SR04 Ultrasonic
─────────────     ──────────────────
3.3V      ──────> VCC
GND       ──────> GND  
GPIO 12   ──────> TRIG
GPIO 14   ──────> ECHO

ESP32 DevKit     Rain Sensor
─────────────     ──────────────────
3.3V      ──────> VCC (+)
GND       ──────> GND (-)
GPIO 36   ──────> Signal (AO)

ESP32 DevKit     LED
─────────────     ──────────────────
GPIO 2    ──────> Anode (+ via 220Ω)
GND       ──────> Cathode (-)
```

---

## 🔍 Debugging

### ESP32 Serial Monitor (115200 baud)
```
[WiFi] Connecting to UBINNMASJIDD
[WiFi] CONNECTED! IP: 192.168.1.50
[MQTT] Connecting to 192.168.1.100:1883
[MQTT] Connected!
[SENSOR] Distance: 25.5 cm | Rain: BASAH
[MQTT] Published: {"timestamp":"12:34:56",...}
```

### Test MQTT
```bash
# Terminal 1: Subscribe ke sensor data
mosquitto_sub -h localhost -t "esp32/sensors" -v

# Terminal 2: Publish test data
mosquitto_pub -h localhost -t "esp32/sensors" -m '{"distance":50,"rain":"KERING"}'
```

### Check Server Status
```
http://localhost:3000/api/esp32/status
```

---

## 📊 Expected Data Format

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

---

## ❌ Common Issues

| Problem | Solution |
|---------|----------|
| "MQTT Error" di server | Mosquitto belum run → `wsl` → `sudo systemctl start mosquitto` |
| ESP32 tidak connect WiFi | WiFi SSID/password salah, atau router tidak ada |
| ESP32 tidak connect MQTT | IP server salah → Check `ipconfig` dan update di code |
| No data di browser | Cek Serial Monitor ESP32, verify MQTT dengan mosquitto_sub |
| Browser says Sensor Real = OFFLINE | MQTT broker belum running atau ESP32 belum connect |

---

**Need Help?** Check serial output dari ESP32 & mosquitto logs! 🔧
