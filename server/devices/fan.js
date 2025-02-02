"use strict";

const mqtt = require("mqtt");
const config = require("../config.js");

class Fan {
  constructor(id) {
    this.client = mqtt.connect(config.mqtt.host);
    this.topic = `${config.topic.fan}/${id}`;
    this.id = id;
    this.state = "OFF";
  }

  start() {
    this.client.on("connect", () => {
      this.client.subscribe(this.topic);
    });

    const publishStatus = () => {
      const status = JSON.stringify({ state: this.state });
      this.client.publish(this.topic, status);
    };

    // Receive messages
    this.client.on("message", (topic, message) => {
      message = message.toString();
      if (message === "ON") {
        console.log(`[${this.topic}] Turning ON`);
        this.state = "ON";
        publishStatus();
      } else if (message === "OFF") {
        console.log(`[${this.topic}] Turning OFF`);
        this.state = "OFF";
        publishStatus();
      } else {
        console.log(`[${this.topic}] Invalid command: ${message}`);
      }
    });
  }
}

module.exports = Fan;
