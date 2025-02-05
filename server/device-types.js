"use strict";
const config = require("./config.js");

const deviceTypes = {
  tempSensor: {
    class: require("./devices/temp-sensor.js"),
    displayName: "Temperature Sensor",
    topic: config.topics.temperature,
  },
  humidSensor: {
    class: require("./devices/humid-sensor.js"),
    displayName: "Humidity Sensor",
    topic: config.topics.humidity,
  },
  heater: {
    class: require("./devices/heater.js"),
    displayName: "Heater",
    topic: config.topics.heater,
  },
  fan: {
    class: require("./devices/fan.js"),
    displayName: "Fan",
    topic: config.topics.fan,
  },
};

module.exports = deviceTypes;
