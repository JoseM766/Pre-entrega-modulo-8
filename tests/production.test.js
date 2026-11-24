import { expect } from "chai";
import { config } from "../src/config/index.js";
import {
  productionEnv,
  makeTempDir,
  removeDir,
  probeApp,
  runServerUntilExit,
  startServer,
  getFreePort,
} from "./helpers/child-process.js";

// Estos tests ejecutan la app en procesos aparte, con NODE_ENV=production, para comprobar cómo se
// comporta en producción (la configuración se lee una sola vez, al importar).

describe("Producción", function () {
  this.timeout(60000);

  let cwd;
  beforeEach(() => (cwd = makeTempDir()));
  afterEach(() => removeDir(cwd));

  describe("criterio sobre los endpoints internos", () => {
    const PROBES = [
      ["get", "/api/mocks/users?qty=2"],
      ["get", "/api/mocks/orders"],
      ["post", "/api/mocks/seed?qty=2"],
      ["post", "/api/mocks/generateData", { body: { users: 1 } }],
      ["get", "/api/loggerTest"],
      ["get", "/api/docs/"],
      ["get", "/api/health"],
    ];

    it("mocks y loggerTest NO están disponibles en producción (404 ROUTE_NOT_FOUND)", () => {
      const { results, config: childConfig } = probeApp(productionEnv(), PROBES, cwd);

      expect(childConfig).to.include({ nodeEnv: "production", isProduction: true, devTools: false });
      for (const key of ["GET /api/mocks/users?qty=2", "GET /api/mocks/orders", "POST /api/mocks/seed?qty=2", "POST /api/mocks/generateData", "GET /api/loggerTest"]) {
        expect(results[key].status, key).to.equal(404);
        expect(results[key].body.error, key).to.equal("ROUTE_NOT_FOUND");
      }
    });

    it("Swagger SÍ está disponible en producción por defecto", () => {
      const { results, config: childConfig } = probeApp(productionEnv(), PROBES, cwd);

      expect(childConfig.swagger).to.equal(true);
      expect(results["GET /api/docs/"].status).to.equal(200);
      expect(results["GET /api/docs/"].contentType).to.match(/text\/html/);
    });

    it("Swagger se puede apagar con SWAGGER_ENABLED=false (404 ROUTE_NOT_FOUND)", () => {
      const { results, config: childConfig } = probeApp(productionEnv({ SWAGGER_ENABLED: "false" }), PROBES, cwd);

      expect(childConfig.swagger).to.equal(false);
      expect(results["GET /api/docs/"].status).to.equal(404);
      expect(results["GET /api/docs/"].body.error).to.equal("ROUTE_NOT_FOUND");
      // lo demás sigue funcionando
      expect(results["GET /api/health"].status).to.be.oneOf([200, 503]);
    });

    it("fuera de producción (development) mocks y loggerTest SÍ están disponibles", () => {
      const { results, config: childConfig } = probeApp(productionEnv({ NODE_ENV: "development" }), PROBES, cwd);

      expect(childConfig.devTools).to.equal(true);
      expect(results["GET /api/mocks/users?qty=2"].status).to.equal(200);
      expect(results["GET /api/loggerTest"].status).to.equal(200);
    });
  });

  describe("comportamiento de la API en producción", () => {
    it("los errores no incluyen details (no se filtra información interna)", () => {
      const { results } = probeApp(productionEnv(), [["get", "/api/nada"]], cwd);

      const response = results["GET /api/nada"];
      expect(response.status).to.equal(404);
      expect(response.body).to.deep.equal({
        status: "error",
        error: "ROUTE_NOT_FOUND",
        message: "La ruta solicitada no existe",
      });
    });

    it("el health check informa el entorno y el estado de la base, y responde 503 si no hay conexión", () => {
      const { results } = probeApp(productionEnv(), [["get", "/api/health"]], cwd);

      const health = results["GET /api/health"];
      expect(health.status).to.equal(503); // este proceso no se conecta a ninguna base
      expect(health.body).to.include({ status: "degraded", environment: "production", database: "disconnected" });
      expect(health.body).to.have.all.keys("status", "environment", "uptime", "timestamp", "database");
    });

    it("no anuncia la tecnología del servidor (sin cabecera X-Powered-By)", () => {
      const { results } = probeApp(productionEnv(), [["get", "/api/health"]], cwd);
      expect(results["GET /api/health"].poweredBy).to.equal(null);
    });

    it("el nivel de logs por defecto es info (sin debug ni http), y se puede cambiar con LOG_LEVEL", () => {
      expect(probeApp(productionEnv(), [], cwd).config.logLevel).to.equal("info");
      expect(probeApp(productionEnv({ LOG_LEVEL: "warning" }), [], cwd).config.logLevel).to.equal("warning");
      // en desarrollo el nivel por defecto es debug
      expect(probeApp(productionEnv({ NODE_ENV: "development" }), [], cwd).config.logLevel).to.equal("debug");
    });

    it("API_BASE_URL define la URL pública de la API (por defecto, http://localhost:PORT)", () => {
      expect(probeApp(productionEnv({ PORT: "9123" }), [], cwd).config.apiBaseUrl).to.equal("http://localhost:9123");
      expect(probeApp(productionEnv({ API_BASE_URL: "https://api.shipnow.com" }), [], cwd).config.apiBaseUrl).to.equal(
        "https://api.shipnow.com"
      );
    });
  });

  describe("validación de variables de entorno al iniciar (la app NO arranca si algo falta o es inválido)", () => {
    const expectStartupFailure = (env, message) => {
      const run = runServerUntilExit(env, cwd);

      expect(run.status, `código de salida (stderr: ${run.stderr})`).to.equal(1);
      expect(run.stderr).to.include("[fatal]").and.include(message);
      expect(run.stdout).to.not.include("escuchando"); // nunca llegó a arrancar
    };

    it("falta MONGODB_URI", () => expectStartupFailure(productionEnv({ MONGODB_URI: undefined }), "Faltan variables de entorno obligatorias: MONGODB_URI"));
    it("falta JWT_SECRET", () => expectStartupFailure(productionEnv({ JWT_SECRET: undefined }), "JWT_SECRET"));
    it("falta PORT", () => expectStartupFailure(productionEnv({ PORT: undefined }), "PORT"));
    it("falta NODE_ENV", () => expectStartupFailure(productionEnv({ NODE_ENV: undefined }), "NODE_ENV"));

    it("faltan varias: las lista todas", () => {
      const run = runServerUntilExit({ NODE_ENV: "production" }, cwd);
      expect(run.status).to.equal(1);
      expect(run.stderr).to.include("PORT").and.include("MONGODB_URI").and.include("JWT_SECRET");
    });

    it("una variable vacía cuenta como faltante", () => expectStartupFailure(productionEnv({ MONGODB_URI: "   " }), "MONGODB_URI"));
    it("PORT no numérico", () => expectStartupFailure(productionEnv({ PORT: "abc" }), "La variable PORT debe ser un número entero positivo"));
    it("NODE_ENV inválido", () => expectStartupFailure(productionEnv({ NODE_ENV: "staging" }), "La variable NODE_ENV tiene un valor inválido"));
    it("MONGODB_URI que no es de MongoDB", () => expectStartupFailure(productionEnv({ MONGODB_URI: "http://localhost:27017" }), 'debe empezar con "mongodb://"'));
    it("JWT_SECRET demasiado corto en producción", () => expectStartupFailure(productionEnv({ JWT_SECRET: "corto" }), "al menos 16 caracteres"));
    it("LOG_LEVEL inválido", () => expectStartupFailure(productionEnv({ LOG_LEVEL: "ruidoso" }), "La variable LOG_LEVEL tiene un valor inválido"));
    it("SWAGGER_ENABLED inválido", () => expectStartupFailure(productionEnv({ SWAGGER_ENABLED: "quizas" }), 'SWAGGER_ENABLED debe ser "true" o "false"'));
    it("API_BASE_URL inválida", () => expectStartupFailure(productionEnv({ API_BASE_URL: "no es una url" }), "API_BASE_URL no es una URL válida"));

    it("fuera de producción un JWT_SECRET corto sí se acepta (ej. desarrollo)", () => {
      const { config: childConfig } = probeApp(productionEnv({ NODE_ENV: "development", JWT_SECRET: "corto" }), [], cwd);
      expect(childConfig.nodeEnv).to.equal("development");
    });
  });

  describe("arranque real del servidor (como lo ejecuta Docker)", () => {
    it("arranca con NODE_ENV=production, responde health, Swagger y un endpoint principal, y se apaga ordenadamente", async function () {
      const port = await getFreePort();
      const server = startServer(productionEnv({ PORT: String(port), MONGODB_URI: config.mongoUri }), cwd);

      try {
        await server.waitFor("Servidor ShipNow escuchando");
        const base = `http://127.0.0.1:${port}`;

        // health check
        const health = await fetch(`${base}/api/health`);
        const healthBody = await health.json();
        expect(health.status).to.equal(200);
        expect(healthBody).to.include({ status: "ok", environment: "production", database: "connected" });

        // Swagger
        const docs = await fetch(`${base}/api/docs/`);
        expect(docs.status).to.equal(200);
        expect(await docs.text()).to.include("swagger-ui");

        // endpoint principal (público)
        const products = await fetch(`${base}/api/products`);
        const productsBody = await products.json();
        expect(products.status).to.equal(200);
        expect(productsBody).to.include.keys("data", "page", "limit", "total", "totalPages");

        // endpoints internos no disponibles
        expect((await fetch(`${base}/api/mocks/users`)).status).to.equal(404);
        expect((await fetch(`${base}/api/loggerTest`)).status).to.equal(404);

        // En Windows no existe SIGTERM como señal: ahí solo se verifica lo anterior.
        if (process.platform === "win32") return;

        server.child.kill("SIGTERM");
        const { code } = await server.exited;
        expect(code).to.equal(0);
        expect(server.output.text).to.include("SIGTERM").and.include("Servidor detenido correctamente");
      } finally {
        server.child.kill("SIGKILL");
      }
    });

    it("los logs de producción no incluyen debug ni http (no hay logs excesivos)", async () => {
      const port = await getFreePort();
      const server = startServer(productionEnv({ PORT: String(port), MONGODB_URI: config.mongoUri }), cwd);

      try {
        await server.waitFor("Servidor ShipNow escuchando");
        await fetch(`http://127.0.0.1:${port}/api/health`);
        await new Promise((resolve) => setTimeout(resolve, 300));

        expect(server.output.text).to.include("[info]");
        expect(server.output.text).to.not.include("[http]");
        expect(server.output.text).to.not.include("[debug]");
      } finally {
        server.child.kill("SIGKILL");
      }
    });
  });
});
