"use strict";

const mqtt = require("mqtt");
const config = require("../config.js");

class TempSensor {
  constructor(id) {
    this.client = mqtt.connect(config.mqtt.host);
    this.topic = `${config.topic.temperature}/${id}`;
    this.temperature = null;
  }

  start() {
    setInterval(() => {
      this.temperature = (17 + Math.random() * 15).toFixed(1);
      this.client.publish(this.topic, this.temperature);
      console.log(`[${this.topic}] Temperature: ${this.temperature} °C`);
    }, 10000);
  }

  getStatus() {
    return { temperature: this.temperature };
  }
}

module.exports = TempSensor;
