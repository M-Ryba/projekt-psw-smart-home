"use strict";
const express = require("express");
const mqtt = require("mqtt");
const config = require("./config.js");

const app = express();
app.use(express.json()); // Add this line to parse JSON request bodies

const client = mqtt.connect(config.mqtt.host);

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

// Arrays that hold all devices and their statuses
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
    console.error("Unknown device type:", type);
    return null;
  }
  if (params.room && !config.rooms.includes(params.room)) {
    console.error("Unknown room:", params.room);
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
  client.subscribe(`${device.topic}/status`);
  return device;
}

client.on("connect", () => {
  devices.forEach((device) => {
    client.subscribe(`${device.topic}/status`);
  });
  client.subscribe(`${config.topic.device}/add`);
});

client.on("message", (topic, message) => {
  if (topic === `${config.topic.device}/add`) {
    const device = JSON.parse(message.toString());
    addDevice(device.type, device);
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
    client.publish(topic, JSON.stringify(data));
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

// Start the express server
app.listen(3333, () => {
  console.log("Smart Home server is running on port 3333");
});
