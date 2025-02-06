"use strict";

const mqtt = require("mqtt");
const config = require("../config.js");
const logger = require("../logger.js");

class Heater {
  constructor(id) {
    this.client = mqtt.connect(config.mqtt.host);
    this.topic = `${config.topics.heater}/${id}`;
    this.id = id;
    this.state = "OFF";
  }

  publishStatus = () => {
    const status = JSON.stringify({ state: this.state });
    this.client.publish(`${this.topic}/status`, status);
  };

  start() {
    this.client.on("connect", () => {
      this.client.subscribe(this.topic);
      this.publishStatus();
    });

    // Receive messages
    this.client.on("message", (topic, message) => {
      const data = JSON.parse(message.toString());
      if (data.state === "ON" || data.state === "OFF") {
        logger.verbose(`[${this.topic}] Turning ${data.state}`);
        this.state = data.state;
        this.publishStatus();
      } else {
        logger.error(`[${this.topic}] Invalid command`, { message });
      }
    });

    // Simulate a device startup delay
    setTimeout(() => {
      this.publishStatus();
    }, 2000);
  }
}

module.exports = Heater;
