"use strict";
const express = require("express");
const mqtt = require("mqtt");
const config = require("./config.js");
const deviceTypes = require("./device-types.js");
const WebSocket = require("ws");
const logger = require("./logger.js");

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
    return true;
  } catch (error) {
    logger.error("Error removing device:", { id, error: error.message });
    return false;
  }
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

// Adding example devices
addDevice("tempSensor", {
  name: "Living Room Temperature Sensor",
  room: "Living Room",
});
addDevice("humidSensor", {
  name: "Living Room Humidity Sensor",
  room: "Living Room",
});
addDevice("heater", {
  name: "Living Room Heater",
  room: "Living Room",
});
addDevice("fan", {
  name: "Living Room Fan",
  room: "Living Room",
});

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
    res.status(200).send(`Device with ID ${id} successfully removed`);
  } else {
    res.status(404).send(`Device with ID ${id} not found`);
  }
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
