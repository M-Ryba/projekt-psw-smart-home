"use strict";

const config = {
  mqtt: {
    host: "mqtt://localhost:1883",
  },
  topics: {
    main: "home",
    log: "home/log",
    temperature: "home/sensor/temperature",
    humidity: "home/sensor/humidity",
    heater: "home/heater",
    fan: "home/fan",
  },
  rooms: ["Living Room", "Bedroom", "Kitchen", "Bathroom"],
};

module.exports = config;
