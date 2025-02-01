"use strict";

const mqtt = require("mqtt");
const config = require("../config.js");

class FanSwitch {
  constructor(id, fanId) {
    this.client = mqtt.connect(config.mqtt.host);
    this.topic = `${config.topic.fanSwitch}/${id}`;
    this.fanId = fanId;
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
        console.log(`[${this.topic}] Turning ON the fan ${this.fanId}`);
        this.client.publish(`${config.topic.fan}/${this.fanId}`, "ON");
      } else if (this.status === "OFF") {
        console.log(`[${this.topic}] Turning OFF the fan ${this.fanId}`);
        this.client.publish(`${config.topic.fan}/${this.fanId}`, "OFF");
      }
    });
  }

  getStatus() {
    return { status: this.status };
  }
}

module.exports = FanSwitch;
