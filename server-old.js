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
// FIREBASE INITIALIZATION
// ============================================================================
let db;
let demoMode = false;
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
  // Create mock database for demo
  const demoData = {
    measurements: {},
    parameters: { current: {} }
  };
  db = {
    ref: (path) => ({
      push: () => ({
        set: (data) => {
          if (!demoData[path]) demoData[path] = {};
          demoData[path][Date.now()] = data;
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
// MQTT CONFIGURATION & INITIALIZATION
// ============================================================================
const mqttBroker = process.env.MQTT_BROKER || "wss://d089792bed824fa48635d8ef188c6799.s1.eu.hivemq.cloud:8884/mqtt";
const mqttClient = mqtt.connect(mqttBroker, {
  username: process.env.MQTT_USER || "pomclear",
  password: process.env.MQTT_PASSWORD || "Pomclear123",
  protocol: "wss",
  rejectUnauthorized: false,
});

// MQTT Topics untuk Spectrometer MICROWAT
const topics = [
  "microwat/spectrometer/absorbance",      // Nilai absorbansi dari spektrofotometer
  "microwat/spectrometer/wavelength",      // Panjang gelombang pengukuran
  "microwat/control/start",                // Kontrol mulai pengukuran
  "microwat/control/stop",                 // Kontrol henti pengukuran
  "microwat/status/online",                // Status online Raspberry Pi
  "microwat/status/measurement",           // Status pengukuran aktif
  "microwat/parameters/initial_concentration",  // Konsentrasi awal limbah
  "microwat/parameters/wavelength_ref",        // Panjang gelombang referensi
];

mqttClient.on("connect", () => {
  console.log("✅ Connected to MQTT Broker (MICROWAT)");
  mqttClient.subscribe(topics, (err) => {
    if (err) {
      console.error(`❌ Subscription error: ${err.message}`);
    } else {
      console.log(`📡 Subscribed to MICROWAT topics`);
    }
  });
});

// Store latest data in memory for quick access
let latestMeasurement = {
  absorbance: null,
  wavelength: null,
  timestamp: null,
  concentration: null,
  degradation: null,
  status: "idle"
};

mqttClient.on("message", (topic, message) => {
  const msgStr = message.toString();
  const timestamp = new Date().toISOString();

  console.log(`📥 [${timestamp}] ${topic}: ${msgStr}`);

  // Process mensuration data
  if (topic === "microwat/spectrometer/absorbance") {
    latestMeasurement.absorbance = parseFloat(msgStr);
    latestMeasurement.timestamp = timestamp;
    
    // Calculate concentration and degradation
    calculateAndStore(latestMeasurement);
    
    // Broadcast to connected clients
    io.emit("spectrometerUpdate", latestMeasurement);
  } else if (topic === "microwat/spectrometer/wavelength") {
    latestMeasurement.wavelength = parseFloat(msgStr);
  } else if (topic === "microwat/status/online") {
    latestMeasurement.status = msgStr === "1" ? "online" : "offline";
    io.emit("statusUpdate", { status: latestMeasurement.status });
  } else if (topic === "microwat/status/measurement") {
    latestMeasurement.measuring = msgStr === "1";
    io.emit("measurementStatus", { measuring: latestMeasurement.measuring });
  }
});

mqttClient.on("error", (error) => {
  console.error("❌ MQTT Error:", error);
});

io.on("connection", (socket) => {
  console.log("🔌 WebSocket client connected:", socket.id);

  // Send current data
  socket.emit("currentMeasurement", latestMeasurement);

  // Handle publish requests
  socket.on("publish", (data) => {
    const { topic, message } = data;
    mqttClient.publish(topic, message);
    console.log(`📤 Published to ${topic}: ${message}`);
  });

  socket.on("disconnect", () => {
    console.log("🔌 WebSocket client disconnected:", socket.id);
  });
});

// ============================================================================
// UTILITY FUNCTIONS - DATA PROCESSING
// ============================================================================

/**
 * Hukum Beer-Lambert: A = ε × c × l
 * A = absorbansi, ε = koefisien ekstinsi molar, c = konsentrasi, l = panjang sel
 */
function calculateConcentrationFromAbsorbance(absorbance, moldExtinctionCoeff = 1000, pathLength = 1) {
  if (!absorbance || absorbance <= 0) return 0;
  return (absorbance / (moldExtinctionCoeff * pathLength)) * 1000; // ppm
}

/**
 * Hitung persentase degradasi
 * Degradasi (%) = ((C0 - Ct) / C0) × 100
 */
function calculateDegradationPercentage(initialConcentration, currentConcentration) {
  if (!initialConcentration || initialConcentration === 0) return 0;
  const degradation = ((initialConcentration - currentConcentration) / initialConcentration) * 100;
  return Math.max(0, Math.min(100, degradation)); // Ensure 0-100%
}

/**
 * Deteksi steady-state: nilai absorbansi relatif konstan
 */
function isSteadyState(measurements, threshold = 0.05) {
  if (measurements.length < 5) return false;
  const recent = measurements.slice(-5);
  const avg = recent.reduce((a, b) => a + b, 0) / recent.length;
  const variance = recent.every(val => Math.abs(val - avg) < threshold);
  return variance;
}

/**
 * Calculate and store measurement data
 */
async function calculateAndStore(measurement) {
  if (!measurement.absorbance || isNaN(measurement.absorbance)) return;

  // Calculate concentration using Beer-Lambert law
  measurement.concentration = calculateConcentrationFromAbsorbance(measurement.absorbance);

  // Store to Firebase
  try {
    const ref = db.ref("measurements").push();
    await ref.set({
      timestamp: measurement.timestamp,
      absorbance: measurement.absorbance,
      wavelength: measurement.wavelength,
      concentration: measurement.concentration,
      degradation: measurement.degradation,
      status: measurement.status
    });

    console.log("✅ Data saved to Firebase");
  } catch (error) {
    console.error("❌ Failed to save data:", error);
  }
}

// ============================================================================
// REST API ENDPOINTS
// ============================================================================

// Simple in-memory user storage (untuk demo, harusnya database)
const users = new Map();

/**
 * POST: Login
 */
app.post("/api/login", (req, res) => {
  const { email, password } = req.body;
  
  if (!email || !password) {
    return res.status(400).json({ message: "Email dan password diperlukan" });
  }

  const user = users.get(email);
  if (!user || user.password !== password) {
    return res.status(401).json({ message: "Email atau password salah" });
  }

  res.json({
    user: { email: user.email, id: user.id }
  });
});

/**
 * POST: Register
 */
app.post("/api/register", (req, res) => {
  const { email, password } = req.body;
  
  if (!email || !password) {
    return res.status(400).json({ message: "Email dan password diperlukan" });
  }

  if (users.has(email)) {
    return res.status(409).json({ message: "Email sudah terdaftar" });
  }

  const user = {
    id: Date.now().toString(),
    email,
    password
  };

  users.set(email, user);
  res.json({ message: "Akun berhasil dibuat" });
});

/**
 * POST: Reset Password
 */
app.post("/api/reset-password", (req, res) => {
  const { email } = req.body;
  
  if (!email) {
    return res.status(400).json({ message: "Email diperlukan" });
  }

  const user = users.get(email);
  if (!user) {
    // Jangan reveal apakah email terdaftar atau tidak
    return res.json({ message: "Jika email terdaftar, email reset akan dikirim" });
  }

  // Di production, kirim email reset di sini
  console.log(`📧 Password reset untuk: ${email}`);
  res.json({ message: "Email reset telah dikirim" });
});

/**
 * GET: Retrieve stored measurements
 */
app.get("/api/measurements", async (req, res) => {
  try {
    const startDate = req.query.startDate ? new Date(req.query.startDate) : new Date(Date.now() - 24 * 60 * 60 * 1000);
    const endDate = req.query.endDate ? new Date(req.query.endDate) : new Date();

    const snapshot = await db.ref("measurements").once("value");
    const data = snapshot.val() || {};
    
    const measurements = Object.values(data).filter(m => {
      const time = new Date(m.timestamp);
      return time >= startDate && time <= endDate;
    });

    res.json(measurements);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET: Current measurement
 */
app.get("/api/current-measurement", (req, res) => {
  res.json(latestMeasurement);
});

/**
 * POST: Manually save measurement data
 */
app.post("/api/measurements", async (req, res) => {
  try {
    const { absorbance, wavelength, initialConcentration } = req.body;

    if (!absorbance || isNaN(absorbance)) {
      return res.status(400).json({ error: "Invalid absorbance value" });
    }

    const concentration = calculateConcentrationFromAbsorbance(absorbance);
    const degradation = calculateDegradationPercentage(initialConcentration, concentration);

    const measurement = {
      timestamp: new Date().toISOString(),
      absorbance,
      wavelength: wavelength || 254,
      concentration,
      degradation,
      status: "manual"
    };

    const ref = db.ref("measurements").push();
    await ref.set(measurement);

    latestMeasurement = measurement;
    io.emit("spectrometerUpdate", latestMeasurement);

    res.json({
      success: true,
      data: measurement
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET: System status
 */
app.get("/api/status", (req, res) => {
  res.json({
    system: latestMeasurement.status,
    measuring: latestMeasurement.measuring,
    lastUpdate: latestMeasurement.timestamp,
    mqtt: mqttClient.connected ? "connected" : "disconnected"
  });
});

/**
 * POST: Initialize measurement parameters
 */
app.post("/api/parameters", async (req, res) => {
  try {
    const { initialConcentration, wavelength, moldExtinctionCoeff, pathLength } = req.body;
    
    const params = {
      timestamp: new Date().toISOString(),
      initialConcentration,
      wavelength: wavelength || 254,
      moldExtinctionCoeff: moldExtinctionCoeff || 1000,
      pathLength: pathLength || 1
    };

    await db.ref("parameters/current").set(params);

    res.json({
      success: true,
      parameters: params
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET: Retrieve parameters
 */
app.get("/api/parameters", async (req, res) => {
  try {
    const snapshot = await db.ref("parameters/current").once("value");
    const params = snapshot.val() || {};
    res.json(params);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// SERVER STARTUP
// ============================================================================
const PORT = process.env.PORT || 3000;
server.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 MICROWAT Server running on http://localhost:${PORT}`);
});
