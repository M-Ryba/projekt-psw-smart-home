"use strict";

const mqtt = require("mqtt");
const config = require("../config.js");

class HeatSwitch {
  constructor(id, heaterId) {
    this.client = mqtt.connect(config.mqtt.host);
    this.topic = `${config.topic.heaterSwitch}/${id}`;
    this.heaterId = heaterId;
    this.status = "OFF";
  }

  start() {
    this.client.on("connect", () => {
      this.client.subscribe(this.topic);
    });

    // Receive messages
    this.client.on("message", (topic, message) => {
      this.status = message.toString();
      if (this.status === "ON") {
        console.log(`[${this.topic}] Turning ON the heater ${this.heaterId}`);
        this.client.publish(`${config.topic.heater}/${this.heaterId}`, "ON");
      } else if (this.status === "OFF") {
        console.log(`[${this.topic}] Turning OFF the heater ${this.heaterId}`);
        this.client.publish(`${config.topic.heater}/${this.heaterId}`, "OFF");
      }
    });
  }

  getStatus() {
    return { status: this.status };
  }
}

module.exports = HeatSwitch;
