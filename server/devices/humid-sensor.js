"use strict";

const mqtt = require("mqtt");
const config = require("../config.js");

class HumidSensor {
  constructor(id) {
    this.client = mqtt.connect(config.mqtt.host);
    this.topic = `${config.topic.humidity}/${id}`;
    this.humidity = null;
  }

  publishStatus = () => {
    const status = JSON.stringify({ humidity: this.humidity });
    this.client.publish(`${this.topic}/status`, status);
  };

  start() {
    setInterval(() => {
      this.humidity = (35 + Math.random() * 40).toFixed(1);
      this.publishStatus();
      console.log(`[${this.topic}] Humidity: ${this.humidity} %rh`);
    }, 5000);
  }
}

module.exports = HumidSensor;
