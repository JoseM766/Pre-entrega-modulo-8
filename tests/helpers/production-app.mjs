// Script auxiliar: carga la app en un proceso APARTE con las variables de entorno que le pase el test
// (por ejemplo NODE_ENV=production), hace las peticiones indicadas y escribe el resultado como JSON.
// Se necesita un proceso aparte porque la configuración se lee una sola vez, al importar.
import request from "supertest";

const { default: app } = await import("../../src/app.js");
const { config } = await import("../../src/config/index.js");
const { logger } = await import("../../src/config/logger.js");

const probes = JSON.parse(process.env.PROBES ?? "[]");
const results = {};

for (const [method, path, extra] of probes) {
  const req = request(app)[method](path);
  if (extra?.body) req.send(extra.body);
  const res = await req;
  results[`${method.toUpperCase()} ${path}`] = {
    status: res.status,
    body: res.body,
    contentType: res.headers["content-type"],
    poweredBy: res.headers["x-powered-by"] ?? null,
  };
}

console.log(
  "RESULT:" +
    JSON.stringify({
      results,
      config: {
        nodeEnv: config.nodeEnv,
        isProduction: config.isProduction,
        logLevel: logger.level,
        devTools: config.features.devTools,
        swagger: config.features.swagger,
        apiBaseUrl: config.apiBaseUrl,
      },
    })
);
process.exit(0);
