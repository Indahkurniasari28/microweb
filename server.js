const express = require("express");
const http = require("http");
const mqtt = require("mqtt");
const { Server } = require("socket.io");
const admin = require("firebase-admin");
const path = require("path");
const cors = require("cors");
require("dotenv").config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] }
});

app.use(express.static(path.join(__dirname, "public")));
app.use(express.json({ limit: "10mb" }));
app.use(cors());

// ============================================================================
// FIREBASE INITIALIZATION (with demo fallback)
// ============================================================================
let db;
let demoMode = false;
const demoData = {
  measurements: {},
  parameters: { current: {} },
  users: {}
};

try {
  const serviceAccount = require("./serviceAccountKey.json");
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: "https://pomclear-ec893-default-rtdb.asia-southeast1.firebasedatabase.app",
  });
  db = admin.database();
  console.log("✅ Firebase Admin SDK initialized");
} catch (error) {
  console.warn("⚠️  Firebase unavailable - running in DEMO MODE");
  demoMode = true;
  
  db = {
    ref: (path) => ({
      push: () => ({
        set: (data) => {
          const key = Date.now().toString();
          if (!demoData[path]) demoData[path] = {};
          demoData[path][key] = { ...data, id: key };
          return Promise.resolve();
        }
      }),
      set: (data) => {
        demoData[path] = data;
        return Promise.resolve();
      },
      once: (event) => Promise.resolve({
        val: () => demoData[path] || {}
      })
    })
  };
}

// ============================================================================
// MQTT CONFIGURATION - Built-in Local Broker
// ============================================================================

// Built-in MQTT server using Node.js net module
const net = require('net');

let esp32Data = {
  distance: 0,
  rainStatus: "KERING",
  status: "OFFLINE",
  lastUpdate: new Date()
};

let mqttClients = [];

// Simple MQTT server
const mqttServer = net.createServer((socket) => {
  console.log('📱 MQTT Client connected from', socket.remoteAddress);
  mqttClients.push(socket);
  
  let buffer = Buffer.alloc(0);
  
  socket.on('data', (data) => {
    buffer = Buffer.concat([buffer, data]);
    
    // Simple MQTT packet parsing (not full MQTT, just enough for PubSubClient)
    // CONNECT packet: 0x10
    // PUBLISH packet: 0x30
    // SUBSCRIBE packet: 0x80
    
    if (buffer.length >= 2) {
      const cmd = buffer[0] >> 4;
      
      if (cmd === 1) { // CONNECT
        console.log('📤 MQTT CONNECT received');
        // Send CONNACK (0x20)
        socket.write(Buffer.from([0x20, 0x02, 0x00, 0x00]));
        buffer = Buffer.alloc(0);
      } else if (cmd === 3) { // PUBLISH
        // Parse PUBLISH packet
        const qos = (buffer[0] >> 1) & 0x3;
        let offset = 1;
        
        // Decode remaining length
        let multiplier = 1;
        let value = 0;
        let index = 1;
        do {
          value += (buffer[index] & 0x7f) * multiplier;
          multiplier *= 128;
          index++;
        } while ((buffer[index - 1] & 0x80) !== 0);
        
        offset = index;
        
        // Get topic length
        const topicLen = (buffer[offset] << 8) | buffer[offset + 1];
        offset += 2;
        
        const topic = buffer.toString('utf8', offset, offset + topicLen);
        offset += topicLen;
        
        // Get payload
        const payloadLen = buffer.length - offset;
        if (payloadLen > 0) {
          const payload = buffer.toString('utf8', offset, offset + payloadLen);
          
          if (topic === 'esp32/sensors') {
            try {
              const data = JSON.parse(payload);
              console.log(`📨 ESP32 Sensor Data:`, data);
              
              esp32Data = {
                distance: data.ultrasonic_distance,
                distanceStatus: data.ultrasonic_status,
                rainStatus: data.rain_sensor,
                status: data.esp_status,
                wifiSignal: data.wifi_rssi,
                timestamp: data.timestamp,
                lastUpdate: new Date()
              };
              
              io.emit("esp32Data", esp32Data);
              console.log(`✅ Broadcasted ESP32 data to clients`);
            } catch (e) {
              console.error('❌ Error parsing ESP32 data:', e.message);
            }
          }
        }
        
        // Send PUBACK if QoS > 0
        if (qos > 0) {
          socket.write(Buffer.from([0x40, 0x02, 0, 0]));
        }
        
        buffer = Buffer.alloc(0);
      } else if (cmd === 8) { // SUBSCRIBE
        console.log('📤 MQTT SUBSCRIBE received');
        // Send SUBACK
        socket.write(Buffer.from([0x90, 0x03, 0, 1, 0]));
        buffer = Buffer.alloc(0);
      } else if (cmd === 12) { // PING
        console.log('💓 MQTT PINGREQ');
        socket.write(Buffer.from([0xd0, 0x00]));
        buffer = Buffer.alloc(0);
      }
    }
  });
  
  socket.on('end', () => {
    console.log('📱 MQTT Client disconnected');
    mqttClients = mqttClients.filter(c => c !== socket);
  });
  
  socket.on('error', (err) => {
    console.error('❌ MQTT Socket error:', err.message);
  });
});

// Start built-in MQTT server on port 1883
mqttServer.listen(1883, '0.0.0.0', () => {
  console.log('🟢 Built-in MQTT Broker running on 0.0.0.0:1883');
});

mqttServer.on('error', (error) => {
  console.error('❌ MQTT Server error:', error.message);
});

// Also try to connect to cloud MQTT as fallback

// ============================================================================
// LEGACY MQTT - Cloud Broker (opsional, untuk compatibility)
// ============================================================================
const mqttBroker = process.env.MQTT_BROKER || "wss://d089792bed824fa48635d8ef188c6799.s1.eu.hivemq.cloud:8884/mqtt";
const mqttClient = mqtt.connect(mqttBroker, {
  username: process.env.MQTT_USER || "pomclear",
  password: process.env.MQTT_PASSWORD || "Pomclear123",
  protocol: "wss",
  rejectUnauthorized: false,
});

mqttClient.on("connect", () => {
  console.log("✅ Cloud MQTT Broker connected");
  mqttClient.subscribe("microwat/#", { qos: 1 });
});

mqttClient.on("message", (topic, message) => {
  console.log(`📨 Cloud MQTT: ${topic} = ${message.toString()}`);
});

mqttClient.on("error", (error) => {
  console.warn("⚠️  Cloud MQTT Error (continuing):", error.message);
});

// ============================================================================
// SPECTROMETER DATA SIMULATOR
// ============================================================================
class SpectrometerSimulator {
  constructor() {
    this.measuring = false;
    this.initialConcentration = 100; // ppm
    this.currentConcentration = 100;
    this.moldExtinctionCoeff = 1000; // L/(mol·cm)
    this.pathLength = 1; // cm
    this.wavelength = 254; // nm
    this.degradationRate = 0.8; // ppm/minute
    this.steadyStateThreshold = 0.05; // 5% untuk steady state
    this.measurementCount = 0;
  }

  start() {
    this.measuring = true;
    this.measurementCount = 0;
    this.currentConcentration = this.initialConcentration;
    console.log("🚀 Spectrometer measurement started");
  }

  stop() {
    this.measuring = false;
    console.log("⏹️  Spectrometer measurement stopped");
  }

  reset() {
    this.measuring = false;
    this.measurementCount = 0;
    this.currentConcentration = this.initialConcentration;
    console.log("🔄 Spectrometer reset");
  }

  getMeasurement() {
    if (!this.measuring) {
      return null;
    }

    this.measurementCount++;

    // Simulate degradation dengan exponential decay
    const timeElapsed = this.measurementCount * 0.5; // every 30 second = 0.5 minute
    const degradationMultiplier = Math.exp(-0.05 * timeElapsed);
    this.currentConcentration = this.initialConcentration * degradationMultiplier;

    // Calculate absorbance menggunakan Beer-Lambert Law: A = ε * c * l
    const absorbance = (this.moldExtinctionCoeff * this.currentConcentration * this.pathLength) / 1000000;

    // Calculate degradation percentage
    const degradation = ((this.initialConcentration - this.currentConcentration) / this.initialConcentration) * 100;

    // Check for steady state
    const change = Math.abs(this.currentConcentration * degradationMultiplier - this.currentConcentration);
    const isSteadyState = (change / this.currentConcentration) < this.steadyStateThreshold && degradation > 90;

    return {
      id: `measurement-${Date.now()}`,
      timestamp: new Date().toISOString(),
      wavelength: this.wavelength,
      absorbance: Math.max(0, absorbance + (Math.random() - 0.5) * 0.01), // Add small noise
      concentration: Math.max(0, this.currentConcentration),
      degradation: Math.min(100, Math.max(0, degradation)),
      status: isSteadyState ? 'steady-state' : (this.measuring ? 'measuring' : 'idle'),
      steadyState: isSteadyState,
      measurementCount: this.measurementCount
    };
  }
}

const spectrometer = new SpectrometerSimulator();
let measurementInterval = null;

// Start measurement simulator setiap 30 detik
function startMeasurementSimulation() {
  if (measurementInterval) return;
  
  measurementInterval = setInterval(async () => {
    const measurement = spectrometer.getMeasurement();
    
    if (measurement) {
      // Save to database
      try {
        await db.ref("measurements").push().set(measurement);
      } catch (error) {
        console.error("Error saving measurement:", error);
      }

      // Broadcast to all connected clients via Socket.io
      io.emit("spectrometerUpdate", measurement);

      // Publish to MQTT
      if (mqttClient.connected) {
        mqttClient.publish("microwat/measurement", JSON.stringify(measurement), { qos: 1 });
      }

      console.log(`📊 Measurement #${measurement.measurementCount}: ${measurement.concentration.toFixed(2)} ppm, ${measurement.degradation.toFixed(1)}%`);
    }
  }, 30000); // Update every 30 seconds
}

// ============================================================================
// SOCKET.IO CONNECTION
// ============================================================================
io.on("connection", (socket) => {
  console.log(`👤 Client connected: ${socket.id}`);

  // Send current system status
  socket.emit("systemStatus", {
    measuring: spectrometer.measuring,
    timestamp: new Date().toISOString()
  });

  // Handle control commands
  socket.on("startMeasurement", () => {
    spectrometer.start();
    startMeasurementSimulation();
    
    // Emit first measurement immediately (instead of waiting 30 seconds)
    const firstMeasurement = spectrometer.getMeasurement();
    if (firstMeasurement) {
      io.emit("spectrometerUpdate", firstMeasurement);
      console.log("📊 First measurement emitted immediately");
    }
    
    io.emit("measurementStarted", { timestamp: new Date().toISOString() });
    console.log("📤 Start measurement command received");
  });

  socket.on("stopMeasurement", () => {
    spectrometer.stop();
    if (measurementInterval) {
      clearInterval(measurementInterval);
      measurementInterval = null;
    }
    io.emit("measurementStopped", { timestamp: new Date().toISOString() });
    console.log("📤 Stop measurement command received");
  });

  socket.on("resetMeasurement", () => {
    spectrometer.reset();
    if (measurementInterval) {
      clearInterval(measurementInterval);
      measurementInterval = null;
    }
    io.emit("measurementReset", { timestamp: new Date().toISOString() });
    console.log("📤 Reset measurement command received");
  });

  socket.on("publish", (data) => {
    if (mqttClient.connected) {
      mqttClient.publish(data.topic, data.message, { qos: 1 });
      console.log(`📤 MQTT published: ${data.topic}`);
    }
  });

  socket.on("disconnect", () => {
    console.log(`👤 Client disconnected: ${socket.id}`);
  });
});

// ============================================================================
// REST API ENDPOINTS
// ============================================================================

// Simple user storage (demo)
const users = new Map();

/**
 * POST: Register
 */
app.post("/api/register", (req, res) => {
  const { email, password } = req.body;
  
  if (!email || !password) {
    return res.status(400).json({ success: false, message: "Email dan password diperlukan" });
  }

  if (users.has(email)) {
    return res.status(409).json({ success: false, message: "Email sudah terdaftar" });
  }

  const user = {
    id: Date.now().toString(),
    email,
    password,
    createdAt: new Date().toISOString()
  };

  users.set(email, user);
  console.log(`✅ User registered: ${email}`);
  
  res.json({ success: true, message: "Akun berhasil dibuat" });
});

/**
 * POST: Login
 */
app.post("/api/login", (req, res) => {
  const { email, password } = req.body;
  
  if (!email || !password) {
    return res.status(400).json({ success: false, message: "Email dan password diperlukan" });
  }

  const user = users.get(email);
  if (!user || user.password !== password) {
    return res.status(401).json({ success: false, message: "Email atau password salah" });
  }

  console.log(`✅ User login: ${email}`);
  
  res.json({
    success: true,
    user: {
      id: user.id,
      email: user.email,
      createdAt: user.createdAt
    }
  });
});

/**
 * POST: Reset Password
 */
app.post("/api/reset-password", (req, res) => {
  const { email } = req.body;
  
  if (!email) {
    return res.status(400).json({ success: false, message: "Email diperlukan" });
  }

  if (!users.has(email)) {
    // Jangan reveal status
    return res.json({ success: true, message: "Jika email terdaftar, email reset akan dikirim" });
  }

  console.log(`📧 Password reset requested: ${email}`);
  res.json({ success: true, message: "Email reset telah dikirim" });
});

/**
 * GET: Retrieve measurements
 */
app.get("/api/measurements", async (req, res) => {
  try {
    const snapshot = await db.ref("measurements").once("value");
    const data = snapshot.val() || {};
    const measurements = Object.values(data).sort((a, b) => 
      new Date(a.timestamp) - new Date(b.timestamp)
    );
    
    res.json(measurements);
  } catch (error) {
    console.error("Error fetching measurements:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET: Get latest measurement
 */
app.get("/api/latest-measurement", async (req, res) => {
  try {
    const snapshot = await db.ref("measurements").orderByChild("timestamp").limitToLast(1).once("value");
    const data = snapshot.val();
    
    if (!data) {
      return res.json({ success: true, measurement: null });
    }

    const measurement = Object.values(data)[0];
    res.json({ success: true, measurement });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET: System Status
 */
app.get("/api/system-status", (req, res) => {
  res.json({
    measuring: spectrometer.measuring,
    demoMode: demoMode,
    mqtt: mqttClient.connected ? "connected" : "disconnected",
    initialConcentration: spectrometer.initialConcentration,
    measurementCount: spectrometer.measurementCount
  });
});

/**
 * GET: ESP32 IoT Status
 */
app.get("/api/esp32/status", (req, res) => {
  res.json({
    success: true,
    esp32Data: esp32Data,
    isOnline: esp32Data.status === "ONLINE"
  });
});

/**
 * POST: Update Parameters
 */
app.post("/api/parameters", async (req, res) => {
  const { initialConcentration, wavelength, moldExtinctionCoeff, pathLength } = req.body;

  if (initialConcentration) spectrometer.initialConcentration = initialConcentration;
  if (wavelength) spectrometer.wavelength = wavelength;
  if (moldExtinctionCoeff) spectrometer.moldExtinctionCoeff = moldExtinctionCoeff;
  if (pathLength) spectrometer.pathLength = pathLength;

  try {
    await db.ref("parameters/current").set({
      initialConcentration: spectrometer.initialConcentration,
      wavelength: spectrometer.wavelength,
      moldExtinctionCoeff: spectrometer.moldExtinctionCoeff,
      pathLength: spectrometer.pathLength,
      updatedAt: new Date().toISOString()
    });

    res.json({ success: true, message: "Parameter diperbarui" });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET: Parameters
 */
app.get("/api/parameters", async (req, res) => {
  try {
    const snapshot = await db.ref("parameters/current").once("value");
    const params = snapshot.val() || {};
    
    res.json({
      success: true,
      parameters: {
        initialConcentration: spectrometer.initialConcentration,
        wavelength: spectrometer.wavelength,
        moldExtinctionCoeff: spectrometer.moldExtinctionCoeff,
        pathLength: spectrometer.pathLength,
        ...params
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================================
// START SERVER
// ============================================================================
const PORT = process.env.PORT || 3000;

server.listen(PORT, "0.0.0.0", () => {
  console.log("\n" + "=".repeat(70));
  console.log("🚀 MICROWAT Server Started".padStart(50));
  console.log("=".repeat(70));
  console.log(`📍 Server running at: http://localhost:${PORT}`);
  console.log(`🔧 Demo Mode: ${demoMode ? "ENABLED" : "DISABLED"}`);
  console.log(`📡 MQTT Status: ${mqttClient.connected ? "CONNECTED" : "CONNECTING..."}`);
  console.log("=".repeat(70) + "\n");

  // Optional: Auto-start measurement simulator
  // spectrometer.start();
  // startMeasurementSimulation();
});

process.on("SIGTERM", () => {
  console.log("SIGTERM received, shutting down gracefully...");
  if (measurementInterval) clearInterval(measurementInterval);
  mqttClient.end();
  server.close(() => process.exit(0));
});
