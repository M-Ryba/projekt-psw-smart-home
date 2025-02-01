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

function addDevice(type, params) {
  let device;
  switch (type) {
    case "tempSensor":
      device = new TempSensor(params.id);
      devices.tempSensors[params.id] = device;
      break;
    case "humidSensor":
      device = new HumidSensor(params.id);
      devices.humidSensors[params.id] = device;
      break;
    case "heatSwitch":
      device = new HeatSwitch(params.id, params.heaterId);
      devices.heatSwitches[params.id] = device;
      break;
    case "fanSwitch":
      device = new FanSwitch(params.id, params.fanId);
      devices.fanSwitches[params.id] = device;
      break;
    default:
      console.error("Unknown device type:", type);
      return;
  }
  device.start();
}

// Adding devices
addDevice("tempSensor", { id: 1 });
addDevice("humidSensor", { id: 1 });
addDevice("heatSwitch", { id: 1, heaterId: 1 });
addDevice("fanSwitch", { id: 1, fanId: 1 });

const ControlCenter = require("./control-center.js");
const controlCenter = new ControlCenter();
controlCenter.start();

// GET devices list with statuses
// curl localhost:3333/devices
app.get("/devices", (req, res) => {
  const deviceStatuses = {};
  for (const type in devices) {
    deviceStatuses[type] = {};
    const deviceList = devices[type];
    for (const id in deviceList) {
      const device = deviceList[id];
      deviceStatuses[type][id] = device.getStatus();
    }
  }
  res.status(200).send({
    devices: deviceStatuses,
  });
});

// Start the express server
app.listen(3333, () => {
  console.log("Smart Home server is running on port 3333");
});
