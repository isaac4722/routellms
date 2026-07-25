const express = require("express");
const { createProxyMiddleware } = require("http-proxy-middleware");
const { execSync, spawn } = require("child_process");
const net = require("net");
require("dotenv").config();

const app = express();

// ─── Configuración ───────────────────────────────────────────
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || "0.0.0.0";
const OMNIRoute_HOST = process.env.OMNIROUTE_HOST || "localhost";
const OMNIRoute_PORT = process.env.OMNIROUTE_PORT || "20128";
const OMNIRoute_URL = `http://${OMNIRoute_HOST}:${OMNIRoute_PORT}`;

// ─── Estado de OmniRoute ─────────────────────────────────────
const state = {
  installed: false,
  running: false,
  ready: false,        // init() terminó completamente
  installPath: null,
  startedByUs: false,
  process: null,
};

// ─── Funciones de utilidad ───────────────────────────────────

// Intenta conectar a un puerto TCP para ver si algo está escuchando
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

// Verifica si OmniRoute está instalado via `which` o `npm list`
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
  } catch (_) {
    // not found via which
  }

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
  } catch (_) {
    // not found via npm
  }

  state.installed = false;
  console.log("⚠️  OmniRoute no está instalado. Ejecuta: npm install -g omniroute");
  return false;
}

// Inicia OmniRoute como proceso hijo
function startOmniRoute() {
  console.log("🚀 Iniciando OmniRoute...");
  const child = spawn("omniroute", [], {
    detached: false,
    stdio: ["pipe", "pipe", "pipe"],
    env: { ...process.env },
  });

  child.stdout.on("data", (data) => {
    const line = data.toString().trim();
    console.log(`[omniroute] ${line}`);
  });

  child.stderr.on("data", (data) => {
    const line = data.toString().trim();
    console.error(`[omniroute:err] ${line}`);
  });

  child.on("error", (err) => {
    console.error("❌ Error al iniciar OmniRoute:", err.message);
    state.running = false;
    state.startedByUs = false;
  });

  child.on("exit", (code, signal) => {
    console.log(`🔴 OmniRoute terminó (código: ${code}, señal: ${signal})`);
    state.running = false;
    state.startedByUs = false;
    state.process = null;
  });

  state.process = child;
  state.startedByUs = true;

  // Poll para verificar que OmniRoute arrancó (hasta 15s)
  waitForOmniRoute();
}

// Verifica en bucle que OmniRoute esté escuchando
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

// ─── Inicialización ──────────────────────────────────────────
async function init() {
  console.log("\n🔍 Verificando estado de OmniRoute...");

  detectInstallation();
  state.running = await checkPort(OMNIRoute_HOST, parseInt(OMNIRoute_PORT));
  state.running
    ? console.log(`✅ OmniRoute ya está corriendo en ${OMNIRoute_HOST}:${OMNIRoute_PORT}`)
    : console.log(`⚠️  OmniRoute NO está corriendo en ${OMNIRoute_HOST}:${OMNIRoute_PORT}`);

  // Si está instalado pero no corriendo, lo iniciamos
  if (state.installed && !state.running) {
    startOmniRoute();
  }

  // Log resumen
  console.log("\n📋 Resumen:");
  console.log(`   Instalado:  ${state.installed ? "✅ Sí" : "❌ No"}`);
  console.log(`   Corriendo:  ${state.running ? "✅ Sí" : "❌ No"}`);
  console.log(`   Bridge:     🟢 ${HOST}:${PORT} → ${OMNIRoute_URL}\n`);
  state.ready = true;
}

// ─── Middleware ──────────────────────────────────────────────
app.use((req, _res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// ─── Health check mejorado ───────────────────────────────────
app.get("/health", (_req, res) => {
  // Verificar estado en vivo de OmniRoute
  checkPort(OMNIRoute_HOST, parseInt(OMNIRoute_PORT)).then((omnirouteRunning) => {
    state.running = omnirouteRunning;
    res.json({
      status: "ok",
      bridge: { host: HOST, port: PORT },
      omniroute: {
        installed: state.installed,
        running: state.running,
        url: OMNIRoute_URL,
        installPath: state.installPath,
        startedByUs: state.startedByUs,
      },
      timestamp: new Date().toISOString(),
    });
  });
});

// ─── Panel de estado web ─────────────────────────────────────
app.get("/status", async (_req, res) => {
  const omnirouteRunning = await checkPort(OMNIRoute_HOST, parseInt(OMNIRoute_PORT));
  state.running = omnirouteRunning;

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>OmniRoute Port Bridge - Status</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #0f172a; color: #e2e8f0;
      display: flex; align-items: center; justify-content: center;
      min-height: 100vh; padding: 20px;
    }
    .container { max-width: 680px; width: 100%; }
    h1 { font-size: 1.5rem; margin-bottom: 24px; color: #38bdf8; }
    .card {
      background: #1e293b; border-radius: 12px; padding: 20px; margin-bottom: 16px;
      border: 1px solid #334155;
    }
    .card h2 { font-size: 1rem; color: #94a3b8; margin-bottom: 12px; text-transform: uppercase; letter-spacing: 0.5px; }
    .row { display: flex; justify-content: space-between; align-items: center; padding: 8px 0; }
    .row + .row { border-top: 1px solid #334155; }
    .label { color: #94a3b8; font-size: 0.9rem; }
    .value { font-size: 0.9rem; font-weight: 600; }
    .badge {
      display: inline-block; padding: 2px 10px; border-radius: 99px;
      font-size: 0.75rem; font-weight: 700; text-transform: uppercase;
    }
    .badge-ok { background: #166534; color: #86efac; }
    .badge-fail { background: #7f1d1d; color: #fca5a5; }
    .badge-warn { background: #854d0e; color: #fde047; }
    .links { display: flex; gap: 8px; flex-wrap: wrap; }
    .links a {
      display: inline-block; padding: 8px 16px; border-radius: 8px;
      background: #334155; color: #e2e8f0; text-decoration: none;
      font-size: 0.85rem; transition: background 0.2s;
    }
    .links a:hover { background: #475569; }
    .footer { text-align: center; margin-top: 24px; font-size: 0.8rem; color: #64748b; }
  </style>
</head>
<body>
  <div class="container">
    <h1>🔌 OmniRoute Port Bridge</h1>

    <div class="card">
      <h2>OmniRoute</h2>
      <div class="row">
        <span class="label">Instalado</span>
        <span class="value"><span class="badge ${state.installed ? 'badge-ok' : 'badge-fail'}">${state.installed ? 'Sí' : 'No'}</span></span>
      </div>
      <div class="row">
        <span class="label">Corriendo</span>
        <span class="value"><span class="badge ${omnirouteRunning ? 'badge-ok' : 'badge-fail'}">${omnirouteRunning ? 'Sí' : 'No'}</span></span>
      </div>
      <div class="row">
        <span class="label">URL</span>
        <span class="value" style="font-family: monospace; font-size: 0.85rem;">${OMNIRoute_URL}</span>
      </div>
      ${state.installPath ? `<div class="row"><span class="label">Ruta</span><span class="value" style="font-family: monospace; font-size: 0.8rem;">${state.installPath}</span></div>` : ''}
      ${state.startedByUs ? `<div class="row"><span class="label">Iniciado por</span><span class="value"><span class="badge badge-warn">Bridge</span></span></div>` : ''}
    </div>

    <div class="card">
      <h2>Bridge</h2>
      <div class="row">
        <span class="label">Host</span>
        <span class="value" style="font-family: monospace;">${HOST}</span>
      </div>
      <div class="row">
        <span class="label">Puerto</span>
        <span class="value" style="font-family: monospace;">${PORT}</span>
      </div>
      <div class="row">
        <span class="label">Estado</span>
        <span class="value"><span class="badge badge-ok">Activo</span></span>
      </div>
    </div>

    <div class="card">
      <h2>Enlaces útiles</h2>
      <div class="links">
        <a href="/dashboard" target="_blank">📊 Dashboard</a>
        <a href="/v1/models" target="_blank">🤖 Modelos (API)</a>
        <a href="/health" target="_blank">❤️ Health (JSON)</a>
      </div>
    </div>

    ${state.ready && !state.installed ? `
    <div class="card" style="border-color: #7f1d1d;">
      <h2>❌ OmniRoute no instalado</h2>
      <p style="color: #94a3b8; font-size: 0.9rem; line-height: 1.5;">
        OmniRoute no está instalado en este entorno. Ejecuta el siguiente comando para instalarlo:
      </p>
      <pre style="background: #0f172a; padding: 12px; border-radius: 8px; margin-top: 12px; font-size: 0.85rem; overflow-x: auto;">npm install -g omniroute</pre>
    </div>
    ` : ''}

    ${state.installed && !omnirouteRunning ? `
    <div class="card" style="border-color: #854d0e;">
      <h2>⚠️ OmniRoute no está corriendo</h2>
      <p style="color: #94a3b8; font-size: 0.9rem; line-height: 1.5;">
        OmniRoute está instalado pero no está corriendo. Si el bridge no lo inició automáticamente, puedes hacerlo manualmente:
      </p>
      <pre style="background: #0f172a; padding: 12px; border-radius: 8px; margin-top: 12px; font-size: 0.85rem; overflow-x: auto;">omniroute</pre>
    </div>
    ` : ''}

    <div class="footer">
      OmniRoute Port Bridge v1.0.0
    </div>
  </div>
</body>
</html>`;

  res.type("html").send(html);
});

// ─── Proxy inverso ───────────────────────────────────────────
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

app.use("/", proxy);

// ─── Iniciar servidor ────────────────────────────────────────
const server = app.listen(PORT, HOST, async () => {
  console.log(`\n✅ Bridge escuchando en http://${HOST}:${PORT}`);
  console.log(`📊 Status web: http://localhost:${PORT}/status`);
  console.log(`❤️ Health:     http://localhost:${PORT}/health`);
  console.log(`🎯 Proxy →     ${OMNIRoute_URL}\n`);
  await init();
});

// Manejo de errores del servidor
server.on("error", (err) => {
  console.error("Error del servidor:", err.message);
  process.exit(1);
});

// WebSockets
server.on("upgrade", proxy.upgrade);

// Cierre graceful
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

module.exports = app;
