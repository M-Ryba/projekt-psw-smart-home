"use strict";

const mqtt = require("mqtt");
const config = require("../config.js");
const logger = require("../logger.js");

class TempSensor {
  constructor(id) {
    this.client = mqtt.connect(config.mqtt.host);
    this.topic = `${config.topics.temperature}/${id}`;
    this.temperature = 20;
  }

  publishStatus = () => {
    const status = JSON.stringify({ temperature: this.temperature });
    this.client.publish(`${this.topic}/status`, status);
  };

  start() {
    this.publishStatus();
    setInterval(() => {
      this.temperature = (17 + Math.random() * 15).toFixed(1);
      this.publishStatus();
      logger.verbose(`[${this.topic}] Temperature: ${this.temperature} °C`);
    }, 10000);
  }
}

module.exports = TempSensor;
