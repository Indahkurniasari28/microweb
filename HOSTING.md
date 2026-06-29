# 🚀 CARA HOSTING IOT PROJECT - LENGKAP

## 📋 DAFTAR ISI
1. [Quick Start](#quick-start)
2. [Langkah Hosting](#langkah-hosting)
3. [ESP32 vs Raspberry Pi](#esp32-vs-raspberry-pi)
4. [Troubleshooting](#troubleshooting)
5. [Maintenance](#maintenance)

---

## ⚡ QUICK START (5 Menit Overview)

**Pilihan Hosting:**
- **DigitalOcean VPS** ($5/bulan) - RECOMMENDED ✅
- **Railway.app** (Free - $5/bulan)
- **Heroku** (Free - paid tier)

**Yang kita hosting:**
- Node.js backend (port 3000)
- MQTT Broker (port 1883)
- Firebase database (cloud)

**Yang tetap sama:**
- Web dashboard (zero changes)
- Database (firebase, zero changes)
- MQTT topics (same)

---

## 📌 LANGKAH HOSTING (Step-by-Step)

### STEP 1: Buat DigitalOcean Account

1. Go to: https://www.digitalocean.com
2. Sign up (email + password)
3. Add payment method (credit card)
4. Complete verification

### STEP 2: Create Droplet (Server Virtual)

1. Click **"Create"** → **"Droplet"**
2. **Choose Image:** Ubuntu 22.04 LTS
3. **Choose Size:** Basic $5/month (1GB RAM)
4. **Choose Region:** Singapore (terdekat dengan Indonesia)
5. **Add SSH Key:** 
   - Generate di local machine atau skip untuk password
   - Windows: gunakan PuTTY atau cmd
   - Linux/Mac: `ssh-keygen -t rsa -b 4096`
6. **Hostname:** iot-server (atau nama lain)
7. Click **"Create Droplet"**
8. **Copy IP address** dari dashboard (misal: `123.45.67.89`)

### STEP 3: SSH ke Server

**Windows (PowerShell):**
```powershell
ssh root@YOUR_DROPLET_IP
# Password dikirim via email

# Example:
ssh root@123.45.67.89
```

**Linux/Mac:**
```bash
ssh root@YOUR_DROPLET_IP
ssh root@123.45.67.89
```

### STEP 4: Setup Server (COPY-PASTE semua)

```bash
# Update system
apt update && apt upgrade -y

# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
apt install -y nodejs npm git

# Install PM2 (auto restart app)
npm install -g pm2

# Clone project dari GitHub
cd /home
git clone https://github.com/YOUR_USERNAME/iot-project.git
cd iot-project

# Install dependencies
npm install

# Start dengan PM2
pm2 start server.js --name "microwat"
pm2 startup
pm2 save

# Open firewall ports
ufw allow 22      # SSH
ufw allow 80      # HTTP
ufw allow 443     # HTTPS
ufw allow 1883    # MQTT
ufw enable

# Check status
pm2 status
pm2 logs microwat
```

### STEP 5: Update ESP32 Code

Edit file `esp32_iot_sensor.ino` line 18:

```cpp
// BEFORE:
const char* MQTT_SERVER = "192.168.18.26";

// AFTER (ganti dengan IP DigitalOcean):
const char* MQTT_SERVER = "123.45.67.89";  // IP server kamu
```

### STEP 6: Upload ke ESP32

1. Buka Arduino IDE
2. Paste kode yang sudah diupdate
3. Select board: **ESP32 Dev Module**
4. Select COM port (device kamu)
5. Click **Upload**
6. Tunggu sampai selesai
7. Open **Serial Monitor** (115200 baud)
8. Tunggu sampai lihat: `[MQTT] Connected!` ✅

### STEP 7: Test Web Dashboard

1. Open browser
2. Go to: `http://YOUR_DROPLET_IP:3000`
3. Example: `http://123.45.67.89:3000`
4. Login (default: `test@example.com` / `123456`)
5. Go to **"Sensor Real"** page
6. Lihat data sensor masuk real-time ✅

### STEP 8: Monitor Server (Live)

```bash
# SSH ke server
ssh root@YOUR_DROPLET_IP

# Watch logs real-time
pm2 logs microwat

# Check status
pm2 status

# Restart jika crash
pm2 restart microwat
```

---

## 🔄 ESP32 vs RASPBERRY PI

### Quick Comparison

| Aspect | ESP32 | Raspberry Pi |
|--------|-------|--------------|
| **Type** | Microcontroller | Single Board Computer |
| **Price** | $10-15 | $50-80 |
| **Power** | Low (battery OK) | High (need AC) |
| **Language** | C++ (Arduino) | Python, C++, etc |
| **GPIO** | 30+ pins | 40 pins |
| **Processing** | Limited | Full computer |
| **WiFi** | Built-in | Dongle needed |
| **Code Change** | Need rewrite | Need rewrite |

### Apakah Backend Berubah?

**TIDAK! Backend tetap SAMA!** ✅

```
Device Code ← BERBEDA (ESP32 C++ vs RPi Python)
    ↓ MQTT message (sama format)
Backend ← SAMA (port 1883, topics sama)
    ↓
Web Dashboard ← SAMA (no changes)
```

### Cara Switch dari ESP32 ke Raspberry Pi

#### Scenario: Sudah hosted, ingin ganti ke RPi

**Step 1: Siapkan Raspberry Pi**
```bash
ssh pi@raspberrypi.local
pip install paho-mqtt
```

**Step 2: Create sensor script**
```bash
nano sensor.py
```

**Paste kode ini:**
```python
#!/usr/bin/env python3
import paho.mqtt.client as mqtt
import time
import json
import board
import adafruit_dht
import os

# Config
MQTT_SERVER = "123.45.67.89"  # ← GANTI dengan IP DigitalOcean kamu
MQTT_PORT = 1883
MQTT_TOPIC = "esp32/sensors"  # Same topic!

# Sensor
dht = adafruit_dht.DHT22(board.D4)

# MQTT Client
client = mqtt.Client()

def on_connect(client, userdata, flags, rc):
    print(f"Connected with result code {rc}")
    if rc == 0:
        print("✅ MQTT Connected!")

def on_disconnect(client, userdata, rc):
    if rc != 0:
        print(f"Unexpected disconnection: {rc}")

client.on_connect = on_connect
client.on_disconnect = on_disconnect

# Connect MQTT
try:
    client.connect(MQTT_SERVER, MQTT_PORT, 60)
    client.loop_start()
except Exception as e:
    print(f"Failed to connect: {e}")
    exit(1)

# Main loop
print("📡 Sensor reading started...")
while True:
    try:
        # Read sensors
        temp = dht.temperature
        humidity = dht.humidity
        
        if temp is not None and humidity is not None:
            # Create payload (sama format seperti ESP32)
            payload = {
                "timestamp": time.strftime("%H:%M:%S"),
                "temperature": temp,
                "humidity": humidity,
                "esp_status": "ONLINE",
                "mqtt_connected": True
            }
            
            # Publish
            client.publish(MQTT_TOPIC, json.dumps(payload))
            print(f"📨 Published: Temp={temp:.1f}°C, Humidity={humidity:.1f}%")
    
    except Exception as e:
        print(f"Error: {e}")
    
    time.sleep(2)  # Baca setiap 2 detik (sama seperti ESP32)
```

**Step 3: Run**
```bash
python3 sensor.py
```

**Step 4: Dashboard otomatis update!** ✅
- No backend restart needed!
- No code changes on server side!
- Same web dashboard works!

**Step 5: Setup auto-start (optional)**
```bash
crontab -e

# Add line:
@reboot python3 /home/pi/sensor.py
```

---

## 🛠️ TROUBLESHOOTING

### Problem: ESP32 says "rc=-2 retrying"

**Penyebab:** Server firewall closed port 1883

**Solution:**
```bash
# SSH ke server
ssh root@YOUR_DROPLET_IP

# Check firewall
ufw status

# Allow MQTT port
ufw allow 1883

# Restart app
pm2 restart microwat
```

### Problem: Web dashboard tidak load

**Penyebab:** Node.js crash atau port blocked

**Solution:**
```bash
# SSH ke server
ssh root@YOUR_DROPLET_IP

# Check status
pm2 status

# View logs
pm2 logs

# Restart
pm2 restart microwat
```

### Problem: Data tidak masuk ke dashboard

**Penyebab:** MQTT topic tidak match atau server tidak terima

**Solution:**
```bash
# Check server logs real-time
pm2 logs microwat

# Should see:
# 📨 ESP32 Sensor Data: {...}
# ✅ Broadcasted ESP32 data to clients

# If not seeing, check:
# 1. ESP32 WiFi connected? (check serial monitor)
# 2. LED indicator on ESP32?
# 3. Firewall allowing 1883?
```

### Problem: Lupa IP server

**Solution:**
```bash
# Go ke DigitalOcean dashboard
# Click Droplets
# Copy IP dari sana
```

### Problem: Lost SSH connection

**Solution:**
- Just reconnect: `ssh root@IP`
- Server tetap running (PM2 maintain)
- No data loss

---

## 🔧 MAINTENANCE

### Daily
- Check data masuk ke dashboard
- Monitor via: `pm2 logs`

### Weekly
```bash
# SSH ke server
ssh root@YOUR_DROPLET_IP

# Check logs
pm2 logs microwat --tail 100

# Verify ESP32 still sending data
# Should see new entries every 2 seconds
```

### Monthly
```bash
# Update system
apt update && apt upgrade -y

# Backup .env file (jika ada)
cp /home/iot-project/.env ~/backup.env

# Restart just to be safe
pm2 restart microwat
```

### Yearly
- Renew domain (if using domain)
- Review costs
- Plan upgrades

---

## 🔐 SECURITY BEST PRACTICES

### 1. Change SSH Password
```bash
ssh root@YOUR_IP
passwd
# Enter new password twice
```

### 2. Create non-root user (recommended)
```bash
adduser iotuser
usermod -aG sudo iotuser
su - iotuser
```

### 3. Disable password login (use SSH key only)
```bash
sudo nano /etc/ssh/sshd_config

# Find and change:
# PermitRootLogin no
# PasswordAuthentication no

sudo systemctl restart ssh
```

### 4. Setup firewall properly
```bash
ufw status
ufw allow 22      # SSH
ufw allow 1883    # MQTT
ufw allow 3000    # Web
ufw enable
```

---

## 📊 COST BREAKDOWN

| Item | Cost | Notes |
|------|------|-------|
| DigitalOcean Droplet | $5/month | Basic plan (1GB RAM) |
| Domain | $2-5/year | Optional (for HTTPS) |
| Firebase | Free-$25 | Depends on usage |
| **TOTAL** | **~$65/year** | Very affordable! |

---

## 🎯 DEPLOYMENT CHECKLIST

- [ ] Create DigitalOcean account
- [ ] Create Droplet (Ubuntu 22.04 LTS)
- [ ] Copy IP address
- [ ] SSH to server
- [ ] Run setup commands (Node.js + PM2)
- [ ] Clone GitHub project
- [ ] npm install
- [ ] pm2 start
- [ ] Update ESP32 code with server IP
- [ ] Upload Arduino code
- [ ] Test Serial Monitor (see "Connected!")
- [ ] Open web dashboard
- [ ] Verify data flowing in
- [ ] Check pm2 logs
- [ ] Done! ✅

---

## 📚 USEFUL COMMANDS (Reference)

### PM2 Commands
```bash
pm2 start server.js --name "app"    # Start app
pm2 stop app                        # Stop app
pm2 restart app                     # Restart app
pm2 logs app                        # View logs
pm2 monit                           # Monitor CPU/Memory
pm2 delete app                      # Remove app
pm2 startup                         # Auto-start on reboot
pm2 save                            # Save current state
```

### SSH & Server
```bash
ssh root@IP                         # Connect to server
exit                                # Disconnect
scp file.txt root@IP:/home/         # Upload file
scp root@IP:/home/file.txt .        # Download file
ps aux | grep node                  # Check processes
netstat -tulpn | grep 1883          # Check port 1883
```

### Firebase & ENV
```bash
cat .env                            # View environment vars
nano .env                           # Edit environment vars
grep MQTT server.js                 # Search in code
```

---

## 🚀 NEXT STEPS

### After Successful Hosting:

1. **Get Domain** (optional but recommended)
   - Buy at Namecheap.com (~$2-5/year)
   - Point to DigitalOcean IP
   - Setup SSL with Let's Encrypt

2. **Add More Sensors**
   - Update device code
   - No backend restart needed!

3. **Multiple Devices**
   - Add Raspberry Pi / Arduino / another ESP32
   - All send to same MQTT broker
   - Same dashboard shows all data!

4. **Monitor & Scale**
   - Keep eye on PM2 logs
   - Upgrade Droplet if needed (costs more)
   - Optimize database queries

---

## 📞 HELP & SUPPORT

### Check Logs First
```bash
pm2 logs microwat --tail 100
```

### Common Error Messages

| Error | Meaning | Fix |
|-------|---------|-----|
| `EADDRINUSE 3000` | Port already used | `pm2 restart` |
| `Cannot find module` | Missing dependency | `npm install` |
| `rc=-2` from ESP32 | MQTT connect failed | Check firewall port 1883 |
| `Connection refused` | Server not running | `pm2 start` |

---

**Good luck with hosting! 🎉**

Jika ada masalah, check logs: `pm2 logs microwat`
