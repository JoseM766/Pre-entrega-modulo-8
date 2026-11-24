import fs from "node:fs";
import os from "node:os";
import net from "node:net";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";

// Utilidades para probar la app como se ejecuta en producción: en un proceso aparte, con sus propias
// variables de entorno y desde una carpeta temporal (así no lee el .env de desarrollo ni ensucia el proyecto).

const PROJECT_ROOT = path.resolve(import.meta.dirname, "../..");
export const SERVER_FILE = path.join(PROJECT_ROOT, "src", "server.js");
const PRODUCTION_APP_FILE = path.join(PROJECT_ROOT, "tests", "helpers", "production-app.mjs");

// Variables válidas de producción para un proceso hijo (se pueden pisar o borrar con undefined).
export const productionEnv = (overrides = {}) => {
  const base = {
    NODE_ENV: "production",
    PORT: "8099",
    MONGODB_URI: "mongodb://127.0.0.1:1/shipnow_prod_unused",
    JWT_SECRET: "un-secreto-largo-de-produccion-1234567890",
  };
  const env = { ...base, ...overrides };
  Object.keys(env).forEach((key) => env[key] === undefined && delete env[key]);
  return env;
};

// Solo se heredan las variables mínimas del sistema, nunca las de la app (MONGODB_URI, JWT_SECRET...).
const systemEnv = () => {
  const keep = {};
  for (const name of ["PATH", "Path", "SystemRoot", "TEMP", "TMP", "HOME"]) {
    if (process.env[name] !== undefined) keep[name] = process.env[name];
  }
  return keep;
};

export const makeTempDir = () => fs.mkdtempSync(path.join(os.tmpdir(), "shipnow-prod-"));
export const removeDir = (dir) => fs.rmSync(dir, { recursive: true, force: true });

// Ejecuta server.js y espera a que termine (sirve para variables inválidas: tiene que salir con error).
export const runServerUntilExit = (env, cwd) =>
  spawnSync(process.execPath, [SERVER_FILE], { env: { ...systemEnv(), ...env }, cwd, encoding: "utf8", timeout: 20000 });

// Carga la app en un proceso aparte, hace las peticiones [método, ruta, extra] y devuelve los resultados.
export const probeApp = (env, probes, cwd) => {
  const child = spawnSync(process.execPath, [PRODUCTION_APP_FILE], {
    env: { ...systemEnv(), ...env, PROBES: JSON.stringify(probes) },
    cwd,
    encoding: "utf8",
    timeout: 30000,
  });
  const line = child.stdout.split("\n").find((text) => text.startsWith("RESULT:"));
  if (!line) throw new Error(`El proceso hijo no devolvió resultados.\nstdout: ${child.stdout}\nstderr: ${child.stderr}`);
  return JSON.parse(line.slice("RESULT:".length));
};

export const getFreePort = () =>
  new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
    server.on("error", reject);
  });

// Levanta server.js de verdad (como lo hace Docker) y devuelve el proceso con su salida acumulada.
export const startServer = (env, cwd) => {
  const child = spawn(process.execPath, [SERVER_FILE], { env: { ...systemEnv(), ...env }, cwd });
  const output = { text: "" };
  child.stdout.on("data", (chunk) => (output.text += chunk));
  child.stderr.on("data", (chunk) => (output.text += chunk));
  const exited = new Promise((resolve) => child.on("exit", (code, signal) => resolve({ code, signal })));

  const waitFor = async (text, timeoutMs = 20000) => {
    const start = Date.now();
    while (!output.text.includes(text)) {
      if (Date.now() - start > timeoutMs) throw new Error(`No apareció "${text}" en la salida del servidor:\n${output.text}`);
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  };

  return { child, output, exited, waitFor };
};
