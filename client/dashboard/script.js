const API_URL = "http://localhost:3333";
const WS_URL = "ws://localhost:3334";

let ws;

function connectWebSocket() {
  ws = new WebSocket(WS_URL);

  ws.onmessage = (event) => {
    const message = JSON.parse(event.data);
    if (message.type === "devices") {
      displayDevices(message.data);
    } else if (message.type === "init") {
      displayDevices(message.data.devices);
      populateRoomList(message.data.rooms);
      populateDeviceTypes(message.data.deviceTypes);
    } else {
      console.log("Unknown WebSocket message type:", message.type);
    }
  };

  ws.onopen = () => {
    console.log("WebSocket connected");
  };

  ws.onerror = (error) => {
    console.error("WebSocket error:", error);
  };

  ws.onclose = () => {
    console.log("WebSocket disconnected. Reconnecting...");
    setTimeout(connectWebSocket, 1000);
  };
}

function formatParameters(type, parameters) {
  switch (type) {
    case "tempSensor":
      return `Temperature: ${parameters.temperature}°C`;
    case "humidSensor":
      return `Humidity: ${parameters.humidity}%`;
    case "heater":
    case "fan":
      return `State: ${parameters.state || "OFF"}`;
    default:
      return Object.entries(parameters)
        .map(([key, value]) => `${key}: ${value}`)
        .join(", ");
  }
}

function displayDevices(devices) {
  const container = document.getElementById("devices");
  container.innerHTML = devices
    .map(
      (device) => `
          <div class="device-card">
              <h3>${device.name}</h3>
              <p>Type: ${device.typeDisplayName}</p>
              <p>Room: ${device.room}</p>
              <p class="status">${formatParameters(
                device.type,
                device.parameters
              )}</p>
              <div class="controls">
                  ${
                    device.type === "heater" || device.type === "fan"
                      ? `
                      <button class="toggle-btn" onclick="toggleDevice('${
                        device.id
                      }', '${
                          device.parameters.state === "ON" ? "OFF" : "ON"
                        }')">
                          Turn ${
                            device.parameters.state === "ON" ? "OFF" : "ON"
                          }
                      </button>
                  `
                      : ""
                  }
                  <button class="delete-btn" onclick="deleteDevice('${
                    device.id
                  }')">Delete</button>
              </div>
          </div>
      `
    )
    .join("");
}

function populateRoomList(rooms) {
  const roomSelect = document.getElementById("deviceRoom");
  roomSelect.innerHTML = `
    <option value="" disabled selected>Select a room</option>
    ${rooms.map((room) => `<option value="${room}">${room}</option>`).join("")}
  `;
}

function populateDeviceTypes(deviceTypes) {
  const typeSelect = document.getElementById("deviceType");
  typeSelect.innerHTML = `
    <option value="" disabled selected>Select a device type</option>
    ${Object.entries(deviceTypes)
      .map(
        ([type, info]) => `<option value="${type}">${info.displayName}</option>`
      )
      .join("")}
  `;
}

async function toggleDevice(id, state) {
  try {
    const response = await fetch(`${API_URL}/devices/${id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ state }),
    });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
  } catch (error) {
    console.error("Error toggling device:", error);
    alert("Failed to toggle device. Please try again.");
  }
}

async function deleteDevice(id) {
  try {
    const response = await fetch(`${API_URL}/devices/${id}`, {
      method: "DELETE",
    });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
  } catch (error) {
    console.error("Error deleting device:", error);
    alert("Failed to delete device. Please try again.");
  }
}

async function addDevice() {
  try {
    const type = document.getElementById("deviceType").value;
    const name = document.getElementById("deviceName").value;
    const room = document.getElementById("deviceRoom").value;

    if (!type || !name || !room) {
      alert("Please fill in all fields");
      return;
    }

    const response = await fetch(`${API_URL}/devices`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ type, name, room }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    // Clear form fields after adding a device
    document.getElementById("deviceType").value = "";
    document.getElementById("deviceName").value = "";
    document.getElementById("deviceRoom").value = "";
  } catch (error) {
    console.error("Error adding device:", error);
    alert("Failed to add device. Please try again.");
  }
}

// Initialize WebSocket connection when page loads
document.addEventListener("DOMContentLoaded", connectWebSocket);
