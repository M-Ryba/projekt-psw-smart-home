"use strict";
const express = require("express");

const app = express();

// Device types
const TempSensor = require("./devices/temp-sensor.js");
const HumidSensor = require("./devices/humid-sensor.js");
const HeatSwitch = require("./devices/heat-switch.js");
const FanSwitch = require("./devices/fan-switch.js");

// Object that holds all devices
const devices = {
  tempSensors: {},
  humidSensors: {},
  heatSwitches: {},
  fanSwitches: {},
};

function getNextId() {
  const allIds = Object.values(devices)
    .flatMap((deviceType) => Object.keys(deviceType))
    .map(Number);
  // Return the next available ID or 1 if there are no devices
  return allIds.length ? Math.max(...allIds) + 1 : 1;
}

function addDevice(type, params) {
  let device;
  const assignedId = getNextId();
  switch (type) {
    case "tempSensor":
      device = new TempSensor(assignedId);
      devices.tempSensors[assignedId] = device;
      break;
    case "humidSensor":
      device = new HumidSensor(assignedId);
      devices.humidSensors[assignedId] = device;
      break;
    case "heatSwitch":
      device = new HeatSwitch(assignedId, params.heaterId);
      devices.heatSwitches[assignedId] = device;
      break;
    case "fanSwitch":
      device = new FanSwitch(assignedId, params.fanId);
      devices.fanSwitches[assignedId] = device;
      break;
    default:
      console.error("Unknown device type:", type);
      return;
  }
  device.start();
  return device;
}

function getDeviceStatuses() {
  const deviceStatuses = {};
  for (const type in devices) {
    deviceStatuses[type] = {};
    const deviceList = devices[type];
    for (const id in deviceList) {
      const device = deviceList[id];
      deviceStatuses[type][id] = device.getStatus();
    }
  }
  return deviceStatuses;
}

// Adding devices
addDevice("tempSensor");
addDevice("humidSensor");
addDevice("heatSwitch", { heaterId: 1 });
addDevice("fanSwitch", { fanId: 1 });

const ControlCenter = require("./control-center.js");
const controlCenter = new ControlCenter();
controlCenter.start();

// GET devices list with statuses
// curl localhost:3333/devices
app.get("/devices", (req, res) => {
  res.status(200).send(getDeviceStatuses());
});

// Start the express server
app.listen(3333, () => {
  console.log("Smart Home server is running on port 3333");
});
