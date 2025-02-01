"use strict";

class Database {
  constructor() {
    this.log = [];
  }

  logSensorData(sensor, value) {
    const entry = {
      time: new Date(),
      sensor: sensor,
      value: value.toString(),
    };
    this.log.push(entry);
  }

  getLastReadings(n) {
    return this.log.slice(-n);
  }
}

module.exports = Database;
