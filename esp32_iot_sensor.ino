// ============================================================================
// ESP32 IoT Sensor - Ultrasonic + Rain Sensor
// WiFi: UBINNMASJIDD / namalengkapgua
// ============================================================================

#include <WiFi.h>
#include <PubSubClient.h>

// ============================================================================
// WiFi Configuration
// ============================================================================
const char* WIFI_SSID = "UBINNMASJIDD";
const char* WIFI_PASSWORD = "namalengkapgua";

// ============================================================================
// MQTT Configuration
// ============================================================================
const char* MQTT_SERVER = "192.168.18.26";  // Your computer's IP
const int MQTT_PORT = 1883;
const char* MQTT_TOPIC = "esp32/sensors";
const char* MQTT_CLIENT_ID = "ESP32_SENSOR_IOT";

// ============================================================================
// GPIO Pins
// ============================================================================
#define ULTRASONIC_TRIG 12      // HC-SR04 TRIG pin
#define ULTRASONIC_ECHO 14      // HC-SR04 ECHO pin
#define RAIN_SENSOR_PIN 36      // Rain sensor analog pin (ADC0)
#define LED_STATUS_PIN 2        // LED untuk status koneksi

// ============================================================================
// Variables
// ============================================================================
WiFiClient wifiClient;
PubSubClient mqttClient(wifiClient);

float ultrasonicDistance = 0;
String rainStatus = "KERING";
unsigned long lastSensorRead = 0;
const unsigned long SENSOR_INTERVAL = 2000;  // Baca sensor setiap 2 detik

// ============================================================================
// Setup
// ============================================================================
void setup() {
  Serial.begin(115200);
  delay(1000);
  
  Serial.println("\n\n===== ESP32 IoT Sensor Starting =====\n");
  
  // Setup pins
  pinMode(ULTRASONIC_TRIG, OUTPUT);
  pinMode(ULTRASONIC_ECHO, INPUT);
  pinMode(RAIN_SENSOR_PIN, INPUT);
  pinMode(LED_STATUS_PIN, OUTPUT);
  digitalWrite(LED_STATUS_PIN, LOW);
  
  // Connect WiFi
  connectToWiFi();
  
  // Setup MQTT
  mqttClient.setServer(MQTT_SERVER, MQTT_PORT);
  mqttClient.setCallback(onMqttMessage);
  
  Serial.println("\n===== Setup Complete =====\n");
}

// ============================================================================
// Main Loop
// ============================================================================
void loop() {
  // Maintain WiFi connection
  if (!WiFi.isConnected()) {
    Serial.println("[WiFi] Terputus, reconnect...");
    connectToWiFi();
  }
  
  // Maintain MQTT connection
  if (!mqttClient.connected()) {
    Serial.println("[MQTT] Terputus, reconnect...");
    connectToMQTT();
  }
  
  mqttClient.loop();
  
  // Read sensors periodically
  if (millis() - lastSensorRead >= SENSOR_INTERVAL) {
    lastSensorRead = millis();
    readSensors();
    publishData();
  }
  
  delay(100);
}

// ============================================================================
// WiFi Connection
// ============================================================================
void connectToWiFi() {
  Serial.print("[WiFi] Connecting to ");
  Serial.println(WIFI_SSID);
  
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 30) {
    delay(500);
    Serial.print(".");
    attempts++;
  }
  
  if (WiFi.isConnected()) {
    Serial.println();
    Serial.print("[WiFi] CONNECTED! IP: ");
    Serial.println(WiFi.localIP());
    digitalWrite(LED_STATUS_PIN, HIGH);
  } else {
    Serial.println();
    Serial.println("[WiFi] FAILED to connect");
    digitalWrite(LED_STATUS_PIN, LOW);
  }
}

// ============================================================================
// MQTT Connection
// ============================================================================
void connectToMQTT() {
  Serial.print("[MQTT] Connecting to ");
  Serial.print(MQTT_SERVER);
  Serial.print(":");
  Serial.println(MQTT_PORT);
  
  int attempts = 0;
  while (!mqttClient.connected() && attempts < 5) {
    if (mqttClient.connect(MQTT_CLIENT_ID)) {
      Serial.println("[MQTT] Connected!");
      // Subscribe to control topic (opsional)
      mqttClient.subscribe("esp32/control");
      return;
    } else {
      Serial.print("[MQTT] Failed, rc=");
      Serial.print(mqttClient.state());
      Serial.println(" retrying...");
      delay(2000);
      attempts++;
    }
  }
}

// ============================================================================
// Sensor Reading
// ============================================================================
void readSensors() {
  // Read Ultrasonic Distance
  ultrasonicDistance = readUltrasonic();
  
  // Read Rain Sensor
  rainStatus = readRainSensor();
  
  // Print to Serial
  Serial.print("[SENSOR] Distance: ");
  Serial.print(ultrasonicDistance);
  Serial.print(" cm | Rain: ");
  Serial.println(rainStatus);
}

// Ultrasonic Sensor (HC-SR04)
float readUltrasonic() {
  // Send 10us pulse
  digitalWrite(ULTRASONIC_TRIG, LOW);
  delayMicroseconds(2);
  digitalWrite(ULTRASONIC_TRIG, HIGH);
  delayMicroseconds(10);
  digitalWrite(ULTRASONIC_TRIG, LOW);
  
  // Read echo time (in microseconds)
  long duration = pulseIn(ULTRASONIC_ECHO, HIGH, 30000);
  
  // Calculate distance: distance = (duration * speed of sound) / 2
  // Speed of sound at 20°C = 343 m/s = 0.0343 cm/µs
  float distance = duration * 0.0343 / 2;
  
  // Return valid distance (between 5-500 cm)
  if (distance < 5 || distance > 500) {
    return 0;  // Out of range
  }
  return distance;
}

// Rain Sensor (analog)
String readRainSensor() {
  // Read analog value (0-4095)
  int sensorValue = analogRead(RAIN_SENSOR_PIN);
  
  // Threshold: jika > 2000 = BASAH, jika <= 2000 = KERING
  // (sesuaikan threshold berdasarkan kalibrasi Anda)
  if (sensorValue > 2000) {
    return "BASAH";
  } else {
    return "KERING";
  }
}

// ============================================================================
// Data Publishing
// ============================================================================
void publishData() {
  if (!mqttClient.connected()) {
    return;
  }
  
  // Create JSON payload
  char payload[256];
  snprintf(payload, sizeof(payload),
    "{\"timestamp\":\"%s\","
    "\"ultrasonic_distance\":%.1f,"
    "\"ultrasonic_status\":\"%s\","
    "\"rain_sensor\":\"%s\","
    "\"esp_status\":\"ONLINE\","
    "\"wifi_ssid\":\"%s\","
    "\"wifi_rssi\":%d,"
    "\"mqtt_connected\":true}",
    getTimestamp(),
    ultrasonicDistance,
    (ultrasonicDistance <= 50) ? "DEKAT" : "JAUH",
    rainStatus.c_str(),
    WIFI_SSID,
    WiFi.RSSI()
  );
  
  // Publish
  if (mqttClient.publish(MQTT_TOPIC, payload)) {
    Serial.print("[MQTT] Published: ");
    Serial.println(payload);
  } else {
    Serial.println("[MQTT] Publish failed");
  }
}

// ============================================================================
// MQTT Message Callback
// ============================================================================
void onMqttMessage(char* topic, byte* payload, unsigned int length) {
  Serial.print("[MQTT] Message from ");
  Serial.print(topic);
  Serial.print(": ");
  
  for (int i = 0; i < length; i++) {
    Serial.print((char)payload[i]);
  }
  Serial.println();
}

// ============================================================================
// Utilities
// ============================================================================
const char* getTimestamp() {
  static char timestamp[20];
  time_t now = time(nullptr);
  struct tm* timeinfo = localtime(&now);
  strftime(timestamp, sizeof(timestamp), "%T", timeinfo);
  return timestamp;
}

// ============================================================================
// Debug Info (call from Serial Monitor)
// ============================================================================
void printStatus() {
  Serial.println("\n===== System Status =====");
  Serial.print("WiFi SSID: ");
  Serial.println(WIFI_SSID);
  Serial.print("WiFi Status: ");
  Serial.println(WiFi.isConnected() ? "CONNECTED" : "DISCONNECTED");
  Serial.print("WiFi IP: ");
  Serial.println(WiFi.localIP());
  Serial.print("WiFi RSSI: ");
  Serial.println(WiFi.RSSI());
  Serial.print("MQTT Status: ");
  Serial.println(mqttClient.connected() ? "CONNECTED" : "DISCONNECTED");
  Serial.print("Ultrasonic Distance: ");
  Serial.print(ultrasonicDistance);
  Serial.println(" cm");
  Serial.print("Rain Status: ");
  Serial.println(rainStatus);
  Serial.println("=======================\n");
}
