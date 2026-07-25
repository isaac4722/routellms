const express = require("express");
const { createProxyMiddleware } = require("http-proxy-middleware");
require("dotenv").config();

const app = express();

// Configuración
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || "0.0.0.0";
const OMNIRoute_HOST = process.env.OMNIROUTE_HOST || "localhost";
const OMNIRoute_PORT = process.env.OMNIROUTE_PORT || "20128";
const OMNIRoute_URL = `http://${OMNIRoute_HOST}:${OMNIRoute_PORT}`;

// Middleware de logging simple
app.use((req, _res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// Health check para que el agente de despliegue del cloud verifique la app
app.get("/health", (_req, res) => {
  res.json({ status: "ok", target: OMNIRoute_URL, timestamp: new Date().toISOString() });
});

// Proxy inverso hacia OmniRoute (dashboard, API y WebSockets)
const proxy = createProxyMiddleware({
  target: OMNIRoute_URL,
  changeOrigin: true,
  ws: true,
  logLevel: "debug",
  onError: (err, req, res) => {
    console.error(`Error de proxy a ${OMNIRoute_URL}:`, err.message);
    if (res && typeof res.status === "function") {
      res.status(502).json({
        error: "OmniRoute no está disponible",
        message: `No se pudo conectar a ${OMNIRoute_URL}. Asegúrate de que OmniRoute esté corriendo.`,
      });
    }
  },
});

app.use("/", proxy);

// Iniciar servidor
const server = app.listen(PORT, HOST, () => {
  console.log(`\n✅ OmniRoute Port Bridge escuchando en http://${HOST}:${PORT}`);
  console.log(`🎯 Redirigiendo todo el tráfico a ${OMNIRoute_URL}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health\n`);
});

// Manejo de errores del servidor (p. ej. puerto ocupado)
server.on("error", (err) => {
  console.error(`Error del servidor:`, err.message);
  process.exit(1);
});

// Soporte de WebSockets
server.on("upgrade", proxy.upgrade);

// Cierre graceful ante señales del sistema
const shutdown = (signal) => {
  console.log(`\n${signal} recibido. Cerrando servidor...`);
  server.close(() => {
    console.log("Servidor cerrado.");
    process.exit(0);
  });
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

module.exports = app;
