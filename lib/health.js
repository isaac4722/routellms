const net = require("net");

const OMNIRoute_HOST = process.env.OMNIROUTE_HOST || "localhost";
const OMNIRoute_PORT = process.env.OMNIROUTE_PORT || "20128";
const OMNIRoute_URL = `http://${OMNIRoute_HOST}:${OMNIRoute_PORT}`;
const PORT = process.env.PORT || "3000";
const HOST = process.env.HOST || "0.0.0.0";

function checkPort(host, port, timeout = 2000) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(timeout);
    socket.on("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.on("error", () => {
      socket.destroy();
      resolve(false);
    });
    socket.on("timeout", () => {
      socket.destroy();
      resolve(false);
    });
    socket.connect(port, host);
  });
}

async function buildHealthResponse(omnirouteState) {
  const omnirouteRunning = await checkPort(
    OMNIRoute_HOST,
    parseInt(OMNIRoute_PORT)
  );

  return {
    status: "ok",
    bridge: { host: HOST, port: PORT },
    omniroute: {
      installed: omnirouteState.installed,
      running: omnirouteRunning,
      url: OMNIRoute_URL,
      installPath: omnirouteState.installPath || null,
      startedByUs: omnirouteState.startedByUs,
    },
    timestamp: new Date().toISOString(),
  };
}

module.exports = { checkPort, buildHealthResponse };
