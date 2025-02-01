"use strict";
const mqtt = require("mqtt");
const config = require("./config");
const Database = require("./db");

class ControlCenter {
  constructor() {
    this.client = mqtt.connect(config.mqtt.host);
    this.database = new Database();
    console.log("Control center started");
  }

  start() {
    this.client.on("connect", () => {
      this.client.subscribe(`${config.topic.main}/#`);
    });

    this.client.on("message", (topic, message) => {
      if (topic.includes(config.topic.temperature)) {
        this.handleTemperature(topic, message);
      }
      if (topic.includes(config.topic.humidity)) {
        this.handleHumidity(topic, message);
      }
      if (topic == config.topic.log) {
        console.log(this.database.getLastReadings(message));
      }
    });
  }

  handleTemperature(topic, temperature) {
    if (temperature < config.threshold.temperature.min) {
      console.log(`Temperature too low in ${topic}, turning ON the heater`);
      this.client.publish(`${config.topic.heaterSwitch}/1`, "ON");
    } else if (temperature > config.threshold.temperature.max) {
      console.log(`Temperature too high in ${topic}, turning OFF the heater`);
      this.client.publish(`${config.topic.heaterSwitch}/1`, "OFF");
    }
    this.database.logSensorData(topic, temperature);
  }

  handleHumidity(topic, humidity) {
    if (humidity < config.threshold.humidity.min) {
      console.log(`Humidity too low in ${topic}, turning ON the fan`);
      this.client.publish(`${config.topic.fanSwitch}/1`, "ON");
    } else if (humidity > config.threshold.humidity.max) {
      console.log(`Humidity too high in ${topic}, turning OFF the fan`);
      this.client.publish(`${config.topic.fanSwitch}/1`, "OFF");
    }
    this.database.logSensorData(topic, humidity);
  }
}

module.exports = ControlCenter;
