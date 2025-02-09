"use strict";
const express = require("express");
const mqtt = require("mqtt");
const config = require("./config.js");
const deviceTypes = require("./device-types.js");
const WebSocket = require("ws");
const logger = require("./logger.js");
const storage = require("./storage.js");

// Devices and their statuses storage
const devices = [];
const deviceStatuses = {};

// Express app
const app = express();
app.use(express.json());

// CORS
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE");
  res.header("Access-Control-Allow-Headers", "Content-Type");
  next();
});

// MQTT client
const mqttc = mqtt.connect(config.mqtt.host);

// WebSocket server
const wss = new WebSocket.Server({ port: 3334 });

// WebSocket clients array
const clients = [];

wss.on("connection", (ws, req) => {
  const clientIp = req.socket.remoteAddress;
  clients.push(ws);
  logger.info("WebSocket client connected", {
    clientIp,
    totalClients: clients.length,
  });

  // Send initial data (devices and rooms)
  ws.send(
    JSON.stringify({
      type: "init",
      data: {
        deviceTypes,
        devices: getAllDeviceStatuses(),
        rooms: config.rooms,
      },
    })
  );

  // Remove disconnected clients
  ws.on("close", () => {
    const index = clients.indexOf(ws);
    if (index !== -1) {
      clients.splice(index, 1);
      logger.info("WebSocket client disconnected", {
        clientIp,
        remainingClients: clients.length,
      });
    }
  });
});

// Broadcast to all connected clients
function broadcastDeviceUpdate() {
  const message = JSON.stringify({
    type: "devices",
    data: getAllDeviceStatuses(),
  });

  let failedClients = 0;
  for (let i = 0; i < clients.length; i++) {
    const client = clients[i];
    try {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    } catch (error) {
      failedClients++;
      logger.error("Failed to broadcast to client:", {
        clientIndex: i,
        error: error.message,
      });
    }
  }

  if (failedClients > 0) {
    logger.warn("Broadcast partially failed:", {
      total: clients.length,
      failed: failedClients,
    });
  }
}

function getNextId() {
  const allIds = devices.map((device) => device.id);
  // Return the biggest ID+1 or 0 if there are no devices
  return allIds.length ? Math.max(...allIds) + 1 : 0;
}

function addDevice(type, params) {
  if (params.room && !config.rooms.includes(params.room)) {
    logger.error("Unknown room:", { room: params.room });
    return null;
  }

  const deviceType = deviceTypes[type];
  if (!deviceType) {
    logger.error("Unknown device type:", { type });
    return null;
  }

  const assignedId = getNextId();
  const deviceInstance = new deviceType.class(assignedId, params);
  const device = {
    id: assignedId,
    name: params.name,
    type: type,
    typeDisplayName: deviceType.displayName,
    room: params.room,
    topic: `${deviceType.topic}/${assignedId}`,
  };
  devices.push(device);
  deviceInstance.start();
  mqttc.subscribe(`${deviceType.topic}/${assignedId}/status`);
  logger.info("Device added successfully", { device });
  storage.saveDevices(devices);
  return device;
}

function removeDevice(id) {
  const index = devices.findIndex((device) => device.id === id);
  if (index === -1) {
    logger.error("Failed to remove device:", {
      id,
      reason: "Device not found",
    });
    return false;
  }

  try {
    const device = devices[index];
    mqttc.unsubscribe(`${device.topic}/status`);
    delete deviceStatuses[device.id];
    devices.splice(index, 1);
    logger.info("Device removed successfully:", { id });
    storage.saveDevices(devices);
    return true;
  } catch (error) {
    logger.error("Error removing device:", { id, error: error.message });
    return false;
  }
}

// Load stored devices
const savedDevices = storage.loadDevices();
for (const saved of savedDevices) {
  addDevice(saved.type, {
    name: saved.name,
    room: saved.room,
  });
}

mqttc.on("connect", () => {
  logger.info("MQTT client connected");
  devices.forEach((device) => {
    mqttc.subscribe(`${device.topic}/status`);
  });
  mqttc.subscribe(`${config.topics.main}/add`);
});

mqttc.on("message", (topic, message) => {
  try {
    if (topic === `${config.topics.main}/add`) {
      const device = JSON.parse(message.toString());
      logger.info("Adding device via MQTT", { device });
      addDevice(device.type, device);
      broadcastDeviceUpdate();
    } else {
      const device = devices.find(
        (device) => `${device.topic}/status` === topic
      );
      if (device) {
        const parameters = JSON.parse(message.toString());
        deviceStatuses[device.id] = {
          id: device.id,
          name: device.name,
          type: device.type,
          room: device.room,
          parameters,
        };
        logger.verbose("Device status updated:", {
          deviceId: device.id,
          parameters,
        });
        broadcastDeviceUpdate();
      }
    }
  } catch (error) {
    logger.error("Error processing MQTT message:", {
      topic,
      message: message.toString(),
      error: error.message,
    });
  }
});

function getAllDeviceStatuses() {
  return devices.map((device) => ({
    id: device.id,
    name: device.name,
    type: device.type,
    typeDisplayName: device.typeDisplayName,
    room: device.room,
    parameters: deviceStatuses[device.id]?.parameters || {},
  }));
}

function getDeviceStatus(id) {
  const device = devices.find((device) => device.id === parseInt(id));
  if (device) {
    return {
      id: device.id,
      name: device.name,
      type: device.type,
      room: device.room,
      parameters: deviceStatuses[device.id]?.parameters || {},
    };
  }
  return null;
}

// Get all device statuses (GET)
// curl localhost:3333/devices
app.get("/devices", (req, res) => {
  res.status(200).send(getAllDeviceStatuses());
});

// Get specific device status by ID (GET)
// curl localhost:3333/devices/0
app.get("/devices/:id", (req, res) => {
  const deviceStatus = getDeviceStatus(req.params.id);
  if (deviceStatus) {
    res.status(200).send(deviceStatus);
  } else {
    res.status(404).send(`Device with ID ${req.params.id} not found`);
  }
});

// Search devices by name pattern (GET)
// curl localhost:3333/search?name=Living
app.get("/search", (req, res) => {
  const namePattern = req.query.name;
  if (!namePattern) {
    return res.status(400).send("Name pattern is required");
  }
  const regex = new RegExp(namePattern, "i");
  const matchingDevices = devices.filter((device) => regex.test(device.name));
  if (matchingDevices.length === 0) {
    return res.status(404).send("No devices found");
  }
  res.status(200).send(matchingDevices);
});

// Get available rooms (GET)
// curl localhost:3333/rooms
app.get("/rooms", (req, res) => {
  res.status(200).send(config.rooms);
});

// Update device parameters by ID (PATCH)
// curl -X PATCH -H "Content-Type: application/json" -d '{"state": "ON"}' localhost:3333/devices/2
app.patch("/devices/:id", (req, res) => {
  const device = devices.find(
    (device) => device.id === parseInt(req.params.id)
  );
  if (!device) {
    return res.status(404).send(`Device with ID ${req.params.id} not found`);
  }
  const data = req.body;
  if (data) {
    const topic = `${device.topic}`;
    mqttc.publish(topic, JSON.stringify(data));
    broadcastDeviceUpdate();
    return res
      .status(200)
      .send(
        `Device with ID ${req.params.id} updated with data: ${JSON.stringify(
          data
        )}`
      );
  } else {
    return res.status(400).send("Parameters not provided");
  }
});

// Create a new device (POST)
// curl -X POST -H "Content-Type: application/json" -d '{"type":"fan","name":"Bedroom Fan","room":"Bedroom"}' localhost:3333/devices
app.post("/devices", (req, res) => {
  const { type, name, room } = req.body;

  if (!type || !name || !room) {
    return res.status(400).send("Missing required parameters");
  }
  if (!deviceTypes[type]) {
    return res.status(400).send(`Invalid device type: ${type}`);
  }
  if (!config.rooms.includes(room)) {
    return res.status(400).send(`Invalid room: ${room}`);
  }
  const device = addDevice(type, { name, room });
  if (device) {
    broadcastDeviceUpdate();
    return res.status(201).send(device);
  } else {
    return res.status(500).send("Failed to create device");
  }
});

// Delete a device (DELETE)
// curl -X DELETE localhost:3333/devices/0
app.delete("/devices/:id", (req, res) => {
  const id = parseInt(req.params.id);
  if (removeDevice(id)) {
    broadcastDeviceUpdate();
    return res.status(200).send(`Device with ID ${id} successfully removed`);
  } else {
    return res.status(404).send(`Device with ID ${id} not found`);
  }
});

// Load accounts from storage
let accounts = storage.loadAccounts();

// Get specific account by ID (GET)
// curl http://localhost:3333/accounts/0
app.get("/accounts/:id", (req, res) => {
  const id = parseInt(req.params.id);
  const account = accounts.find((acc) => acc.id === id);
  if (!account) {
    return res.status(404).send(`Account with ID ${id} not found`);
  }
  return res.status(200).json(account);
});

// Create a new account (POST)
/*
curl -X POST http://localhost:3333/accounts \
-H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "password": "testpass123"
  }'
*/
app.post("/accounts", (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).send("Missing username or password");
  }
  const newId = accounts.length
    ? Math.max(...accounts.map((a) => a.id)) + 1
    : 0;
  const newAccount = { id: newId, username, password };
  accounts.push(newAccount);
  storage.saveAccounts(accounts);
  logger.info("New account created:", { newAccount });
  return res.status(201).json(newAccount);
});

// Update account password by ID (PATCH)
/*
curl -X PATCH http://localhost:3333/accounts/0 \
  -H "Content-Type: application/json" \
  -d '{
    "oldPassword": "testpass123",
    "newPassword": "newpass123"
  }'
*/
app.patch("/accounts/:id", (req, res) => {
  const id = parseInt(req.params.id);
  const account = accounts.find((acc) => acc.id === id);
  if (!account) {
    return res.status(404).send(`Account with ID ${id} not found`);
  }
  const { oldPassword, newPassword } = req.body;
  if (!oldPassword || !newPassword) {
    return res.status(400).send("Missing old or new password");
  }
  if (account.password !== oldPassword) {
    return res.status(400).send("Invalid old password");
  }
  account.password = newPassword;
  storage.saveAccounts(accounts);
  return res.status(200).json("Password updated successfully");
});

// Delete an account (DELETE)
// curl -X DELETE http://localhost:3333/accounts/0
app.delete("/accounts/:id", (req, res) => {
  const id = parseInt(req.params.id);
  const index = accounts.findIndex((acc) => acc.id === id);
  if (index === -1) {
    return res.status(404).send(`Account with ID ${id} not found`);
  }
  accounts.splice(index, 1);
  storage.saveAccounts(accounts);
  res.status(200).send(`Account with ID ${id} deleted`);
});

// Login (POST)
app.post("/login", (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).send("Missing username or password");
  }
  const account = accounts.find(
    (acc) => acc.username === username && acc.password === password
  );
  if (!account) {
    return res.status(401).send("Invalid credentials");
  }
  res.status(200).send("Login successful");
});

// MQTT error logging
mqttc.on("error", (error) => {
  logger.error("MQTT error:", { error: error.message });
});

// WebSocket error logging
wss.on("error", (error) => {
  logger.error("WebSocket server error:", { error: error.message });
});

// Start the express server
app.listen(3333, () => {
  logger.info("Smart Home server is running on port 3333");
});
