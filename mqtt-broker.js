// ============================================================================
// Simple MQTT Broker using Aedes
// ============================================================================

const aedes = require('aedes');
const net = require('net');
const fs = require('fs');

const PORT = 1883;
const HOST = '0.0.0.0';

// Create MQTT broker instance
const broker = aedes();

// Create TCP server for MQTT
const server = net.createServer(broker.handle);

server.listen(PORT, HOST, () => {
  console.log(`🟢 MQTT Broker running on ${HOST}:${PORT}`);
});

// Handle client connections
broker.on('client', (client) => {
  console.log(`📱 Client connected: ${client.id}`);
});

// Handle client disconnections
broker.on('clientDisconnect', (client) => {
  console.log(`📱 Client disconnected: ${client.id}`);
});

// Handle published messages
broker.on('publish', async (packet, client) => {
  if (packet.topic.includes('esp32')) {
    console.log(`📨 [${packet.topic}] ${packet.payload.toString()}`);
  }
});

// Handle errors
broker.on('error', (error) => {
  console.error('❌ MQTT Error:', error);
});

server.on('error', (error) => {
  console.error('❌ Server Error:', error);
});

console.log('✅ MQTT Broker initialized');
