const WebSocket = require('ws');

let wss = null;

/**
 * Attach the WebSocket.Server instance so broadcaster can reach all clients.
 * Called once from server.js after the WS server is created.
 */
function init(webSocketServer) {
  wss = webSocketServer;
}

/**
 * Broadcast a JSON message to every connected client.
 * @param {object} message  — will be serialized to JSON
 */
function broadcast(message) {
  if (!wss) return;
  const data = JSON.stringify(message);
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(data);
    }
  });
}

module.exports = { init, broadcast };
