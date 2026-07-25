const { createServer } = require("http");
const { parse } = require("url");
const express = require("express");
const next = require("next");
const { createProxyMiddleware } = require("http-proxy-middleware");
const { execSync, spawn } = require("child_process");
const net = require("net");
const { buildHealthResponse } = require("./lib/health");
require("dotenv").config();

// ─── Configuración ──────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || "0.0.0.0";
const OMNIRoute_HOST = process.env.OMNIROUTE_HOST || "localhost";
const OMNIRoute_PORT = process.env.OMNIROUTE_PORT || "20128";
const OMNIRoute_URL = `http://${OMNIRoute_HOST}:${OMNIRoute_PORT}`;

// ─── Estado de OmniRoute ─────────────────────────────────────
const state = {
  installed: false,
  running: false,
  ready: false,
  installPath: null,
  startedByUs: false,
  process: null,
};

// ─── Utilidades ──────────────────────────────────────────────
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

function detectInstallation() {
  try {
    const whichOut = execSync("which omniroute", {
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();
    if (whichOut) {
      state.installed = true;
      state.installPath = whichOut;
      console.log(`✅ OmniRoute instalado en: ${whichOut}`);
      return true;
    }
  } catch (_) {}

  try {
    const npmOut = execSync("npm list -g omniroute --json", {
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
    });
    const parsed = JSON.parse(npmOut);
    if (parsed.dependencies && parsed.dependencies.omniroute) {
      state.installed = true;
      state.installPath = "omniroute (npm global)";
      console.log("✅ OmniRoute instalado via npm global");
      return true;
    }
  } catch (_) {}

  state.installed = false;
  console.log("⚠️  OmniRoute no está instalado. Ejecuta: npm install -g omniroute");
  return false;
}

async function waitForOmniRoute(retries = 15, interval = 1000) {
  for (let i = 0; i < retries; i++) {
    state.running = await checkPort(OMNIRoute_HOST, parseInt(OMNIRoute_PORT));
    if (state.running) {
      console.log("✅ OmniRoute está corriendo y respondiendo");
      return;
    }
    await new Promise((r) => setTimeout(r, interval));
  }
  console.warn("⚠️  OmniRoute no respondió después de " + (retries * interval / 1000) + "s");
}

function startOmniRoute() {
  console.log("🚀 Iniciando OmniRoute...");
  const child = spawn("omniroute", [], {
    detached: false,
    stdio: ["pipe", "pipe", "pipe"],
    env: { ...process.env },
  });

  child.stdout.on("data", (data) => {
    console.log(`[omniroute] ${data.toString().trim()}`);
  });
  child.stderr.on("data", (data) => {
    console.error(`[omniroute:err] ${data.toString().trim()}`);
  });
  child.on("error", (err) => {
    console.error("❌ Error al iniciar OmniRoute:", err.message);
    state.running = false;
    state.startedByUs = false;
  });
  child.on("exit", () => {
    console.log(" OmniRoute terminó");
    state.running = false;
    state.startedByUs = false;
    state.process = null;
  });

  state.process = child;
  state.startedByUs = true;
  waitForOmniRoute();
}

async function init() {
  console.log("\n🔍 Verificando estado de OmniRoute...");
  detectInstallation();
  state.running = await checkPort(OMNIRoute_HOST, parseInt(OMNIRoute_PORT));
  state.running
    ? console.log(`✅ OmniRoute ya está corriendo en ${OMNIRoute_HOST}:${OMNIRoute_PORT}`)
    : console.log(`⚠️  OmniRoute NO está corriendo en ${OMNIRoute_HOST}:${OMNIRoute_PORT}`);

  if (state.installed && !state.running) {
    startOmniRoute();
  }

  console.log("\n📋 Resumen:");
  console.log(`   Instalado:  ${state.installed ? "✅ Sí" : "❌ No"}`);
  console.log(`   Corriendo:  ${state.running ? "✅ Sí" : "❌ No"}`);
  console.log(`   Bridge:     🟢 ${HOST}:${PORT} → ${OMNIRoute_URL}\n`);
  state.ready = true;
}

// ─── Next.js ─────────────────────────────────────────────────
const dev = process.env.NODE_ENV !== "production";
const nextApp = next({ dev });
const nextHandler = nextApp.getRequestHandler();

// Proxy hacia OmniRoute (se usa para rutas dinámicas de OmniRoute)
const proxy = createProxyMiddleware({
  target: OMNIRoute_URL,
  changeOrigin: true,
  ws: true,
  logLevel: "info",
  onError: (err, req, res) => {
    console.error(`Error de proxy a ${OMNIRoute_URL}:`, err.message);
    if (res && typeof res.status === "function") {
      res.status(502).json({
        error: "OmniRoute no está disponible",
        message: `No se pudo conectar a ${OMNIRoute_URL}.`,
        hint: state.installed
          ? "OmniRoute está instalado pero no responde. Revisa /status para más detalles."
          : "OmniRoute no está instalado. Ejecuta: npm install -g omniroute",
      });
    }
  },
});

async function startServer() {
  await nextApp.prepare();

  const app = express();

  app.use((req, _res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
  });

  // Health check JSON
  app.get("/health", async (_req, res) => {
    const health = await buildHealthResponse(state);
    state.running = health.omniroute.running;
    res.json(health);
  });

  // Status alias: redirige al panel web en /
  app.get("/status", (_req, res) => res.redirect("/"));

  // Proxy para las rutas de OmniRoute (todo lo que no sea Next.js o las rutas propias)
  app.use((req, res, next) => {
    const pathname = req.path || "/";
    // No proxyar los assets internos de Next.js ni las rutas propias
    if (
      pathname.startsWith("/_next") ||
      pathname === "/" ||
      pathname === "/status" ||
      pathname === "/health" ||
      pathname === "/favicon.ico"
    ) {
      return next();
    }
    return proxy(req, res, next);
  });

  // Todo lo demás lo maneja Next.js
  app.all("*", (req, res) => {
    const parsedUrl = parse(req.url, true);
    nextHandler(req, res, parsedUrl);
  });

  const server = app.listen(PORT, HOST, async () => {
    console.log(`\n✅ Bridge + Next.js escuchando en http://${HOST}:${PORT}`);
    console.log(`📊 Status web: http://localhost:${PORT}/`);
    console.log(`❤️ Health:     http://localhost:${PORT}/health`);
    console.log(`🎯 Proxy →     ${OMNIRoute_URL}\n`);
    await init();
  });

  server.on("error", (err) => {
    console.error("Error del servidor:", err.message);
    process.exit(1);
  });

  server.on("upgrade", proxy.upgrade);

  const shutdown = (signal) => {
    console.log(`\n${signal} recibido. Cerrando...`);
    if (state.process && state.startedByUs) {
      console.log("Deteniendo OmniRoute...");
      state.process.kill("SIGTERM");
    }
    server.close(() => {
      console.log("Servidor cerrado.");
      process.exit(0);
    });
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

startServer().catch((err) => {
  console.error("Error al iniciar el servidor:", err);
  process.exit(1);
});
