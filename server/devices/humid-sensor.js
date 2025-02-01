"use strict";

const mqtt = require("mqtt");
const config = require("../config.js");

class HumidSensor {
  constructor(id) {
    this.client = mqtt.connect(config.mqtt.host);
    this.topic = `${config.topic.humidity}/${id}`;
    this.humidity = null;
  }

  start() {
    setInterval(() => {
      this.humidity = (35 + Math.random() * 40).toFixed(1);
      this.client.publish(this.topic, this.humidity);
      console.log(`[${this.topic}] Humidity: ${this.humidity} %rh`);
    }, 5000);
  }

  getStatus() {
    return { humidity: this.humidity };
  }
}

module.exports = HumidSensor;
