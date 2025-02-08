const fs = require("fs");
const path = require("path");

const STORAGE_DIR = "./data";
const DEVICES_FILE = path.join(STORAGE_DIR, "devices.json");

// Create directory if it doesn't exist
if (!fs.existsSync(STORAGE_DIR)) {
  fs.mkdirSync(STORAGE_DIR, { recursive: true });
}

// Load devices from file
function loadDevices() {
  try {
    if (fs.existsSync(DEVICES_FILE)) {
      const data = fs.readFileSync(DEVICES_FILE, "utf-8");
      return JSON.parse(data);
    }
  } catch (error) {
    console.error("Failed to load devices:", error.message);
  }
  return [];
}

// Save devices to file
function saveDevices(devices) {
  try {
    fs.writeFileSync(DEVICES_FILE, JSON.stringify(devices, null, 2));
  } catch (error) {
    console.error("Failed to save devices:", error.message);
  }
}

module.exports = {
  loadDevices,
  saveDevices,
};
