"use strict";

const config = {
  mqtt: {
    host: "mqtt://localhost",
  },
  topic: {
    main: "home",
    log: "home/log",
    temperature: "home/sensor/temperature",
    humidity: "home/sensor/humidity",
    heater: "home/heater",
    fan: "home/fan",
    heaterSwitch: "home/switch/heater",
    fanSwitch: "home/switch/fan",
  },
  threshold: {
    temperature: {
      min: 18,
      max: 23,
    },
    humidity: {
      min: 40,
      max: 60,
    },
  },
  rooms: ["Living Room", "Bedroom", "Kitchen", "Bathroom"],
};

module.exports = config;
