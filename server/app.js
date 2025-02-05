"use strict";
const express = require("express");
const mqtt = require("mqtt");
const config = require("./config.js");
const WebSocket = require("ws");

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

wss.on("connection", (ws) => {
  clients.push(ws);

  // Send initial data (devices and rooms)
  ws.send(
    JSON.stringify({
      type: "init",
      data: {
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
    }
  });
});

// Broadcast to all connected clients
function broadcastDeviceUpdate() {
  const message = JSON.stringify({
    type: "devices",
    data: getAllDeviceStatuses(),
  });

  for (let i = 0; i < clients.length; i++) {
    const client = clients[i];
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  }
}

// Device types
const TempSensor = require("./devices/temp-sensor.js");
const HumidSensor = require("./devices/humid-sensor.js");
const Heater = require("./devices/heater.js");
const Fan = require("./devices/fan.js");

// List of available device types
const deviceTypes = {
  tempSensor: TempSensor,
  humidSensor: HumidSensor,
  heater: Heater,
  fan: Fan,
};

// Devices and their statuses array
const devices = [];
const deviceStatuses = {};

function getNextId() {
  const allIds = devices.map((device) => device.id);
  // Return the biggest ID+1 or 0 if there are no devices
  return allIds.length ? Math.max(...allIds) + 1 : 0;
}

function addDevice(type, params) {
  const DeviceClass = deviceTypes[type];
  if (!DeviceClass) {
    console.log("Unknown device type:", type);
    return null;
  }
  if (params.room && !config.rooms.includes(params.room)) {
    console.log("Unknown room:", params.room);
    return null;
  }
  const assignedId = getNextId();
  const deviceInstance = new DeviceClass(assignedId, params);
  const device = {
    id: assignedId,
    name: params.name,
    type,
    room: params.room,
    topic: deviceInstance.topic,
  };
  devices.push(device);
  deviceInstance.start();
  mqttc.subscribe(`${device.topic}/status`);
  return device;
}

function removeDevice(id) {
  const index = devices.findIndex((device) => device.id === id);
  if (index === -1) return false;

  const device = devices[index];
  mqttc.unsubscribe(`${device.topic}/status`);
  delete deviceStatuses[device.id];
  devices.splice(index, 1);
  return true;
}

mqttc.on("connect", () => {
  devices.forEach((device) => {
    mqttc.subscribe(`${device.topic}/status`);
  });
  mqttc.subscribe(`${config.topic.device}/add`);
});

mqttc.on("message", (topic, message) => {
  if (topic === `${config.topic.device}/add`) {
    const device = JSON.parse(message.toString());
    addDevice(device.type, device);
    broadcastDeviceUpdate();
  } else {
    const device = devices.find((device) => `${device.topic}/status` === topic);
    if (device) {
      deviceStatuses[device.id] = {
        id: device.id,
        name: device.name,
        type: device.type,
        room: device.room,
        parameters: JSON.parse(message.toString()),
      };
      broadcastDeviceUpdate();
    }
  }
});

function getAllDeviceStatuses() {
  return devices.map((device) => ({
    id: device.id,
    name: device.name,
    type: device.type,
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

// GET all device statuses
// curl localhost:3333/devices
app.get("/devices", (req, res) => {
  res.status(200).send(getAllDeviceStatuses());
});

// GET specific device status by ID
// curl localhost:3333/devices/0
app.get("/devices/:id", (req, res) => {
  const deviceStatus = getDeviceStatus(req.params.id);
  if (deviceStatus) {
    res.status(200).send(deviceStatus);
  } else {
    res.status(404).send(`Device with ID ${req.params.id} not found`);
  }
});

// GET available rooms
// curl localhost:3333/rooms
app.get("/rooms", (req, res) => {
  res.status(200).send(config.rooms);
});

// Update device parameters by ID
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

// Create a new device
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

// Delete a device
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

// Start the express server
app.listen(3333, () => {
  console.log("Smart Home server is running on port 3333");
});
