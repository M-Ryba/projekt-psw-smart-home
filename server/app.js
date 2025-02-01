"use strict";
const express = require("express");
const config = require("./config.js");

const app = express();

// Device types
const TempSensor = require("./devices/temp-sensor.js");
const HumidSensor = require("./devices/humid-sensor.js");
const HeatSwitch = require("./devices/heat-switch.js");
const FanSwitch = require("./devices/fan-switch.js");

// List of available device types
const deviceTypes = {
  tempSensor: TempSensor,
  humidSensor: HumidSensor,
  heatSwitch: HeatSwitch,
  fanSwitch: FanSwitch,
};

// Arrays that holds all devices
const devices = [];

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
    device: deviceInstance,
  };
  devices.push(device);
  deviceInstance.start();
  return device;
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
addDevice("heatSwitch", {
  name: "Living Room Heater Switch",
  room: "Living Room",
  heaterId: 1,
});
addDevice("fanSwitch", {
  name: "Living Room Fan Switch",
  room: "Living Room",
  fanId: 1,
});

function getAllDeviceStatuses() {
  return devices.map(({ id, name, type, room, device }) => ({
    id,
    name,
    type,
    room,
    parameters: device.getStatus(),
  }));
}

function getDeviceStatus(id) {
  const foundDevice = devices.find((device) => device.id === parseInt(id));
  if (foundDevice) {
    const { id, name, type, room, device } = foundDevice;
    return { id, name, type, room, parameters: device.getStatus() };
  }
  return null;
}

const ControlCenter = require("./control-center.js");
const controlCenter = new ControlCenter();
controlCenter.start();

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

// Start the express server
app.listen(3333, () => {
  console.log("Smart Home server is running on port 3333");
});
