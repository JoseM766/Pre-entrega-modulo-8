import { expect } from "chai";
import request from "supertest";
import winston from "winston";
import app from "../src/app.js";
import { logger } from "../src/config/logger.js";
import { config } from "../src/config/index.js";
import { LOG_LEVELS, LOG_LEVEL_PRIORITY } from "../src/constants/index.js";
import { createAdmin } from "./helpers/factories.js";

// Durante los tests el logger está en silencio. Para poder comprobar QUÉ se registra, se activa
// un transporte "espía" que guarda los logs en memoria y se silencian los transportes reales.
class CaptureTransport extends winston.Transport {
  constructor(store) {
    super();
    this.store = store;
  }
  log(info, callback) {
    this.store.push({ level: info[Symbol.for("level")], message: info.message });
    callback();
  }
}

describe("Logger", () => {
  let captured;
  let capture;
  let originalSilent;

  beforeEach(() => {
    captured = [];
    capture = new CaptureTransport(captured);
    originalSilent = logger.transports.map((transport) => transport.silent);
    logger.transports.forEach((transport) => (transport.silent = true));
    logger.silent = false;
    logger.add(capture);
  });

  afterEach(() => {
    logger.remove(capture);
    logger.transports.forEach((transport, index) => (transport.silent = originalSilent[index]));
    logger.silent = config.isTest;
  });

  describe("GET /api/loggerTest", () => {
    it("200 con la estructura esperada y la lista de niveles", async () => {
      const res = await request(app).get("/api/loggerTest");

      expect(res.status).to.equal(200);
      expect(res.body).to.have.all.keys("status", "message", "levels");
      expect(res.body.status).to.equal("success");
      expect(res.body.message).to.equal("Logs generados correctamente");
      expect(res.body.levels).to.deep.equal(["debug", "http", "info", "warning", "error", "fatal"]);
    });

    it("genera un log de CADA nivel (debug, http, info, warning, error y fatal)", async () => {
      await request(app).get("/api/loggerTest");

      const levels = captured.map((log) => log.level);
      for (const level of Object.values(LOG_LEVELS)) {
        expect(levels, `falta el nivel ${level}`).to.include(level);
      }
      expect(captured.find((log) => log.level === LOG_LEVELS.FATAL).message).to.equal("Log de nivel fatal");
    });
  });

  describe("Configuración del logger", () => {
    it("define los 6 niveles, de más a menos severo (fatal = 0 ... debug = 5)", () => {
      expect(logger.levels).to.deep.equal(LOG_LEVEL_PRIORITY);
      expect(logger.levels[LOG_LEVELS.FATAL]).to.be.below(logger.levels[LOG_LEVELS.ERROR]);
      expect(logger.levels[LOG_LEVELS.ERROR]).to.be.below(logger.levels[LOG_LEVELS.WARNING]);
      expect(logger.levels[LOG_LEVELS.WARNING]).to.be.below(logger.levels[LOG_LEVELS.INFO]);
      expect(logger.levels[LOG_LEVELS.INFO]).to.be.below(logger.levels[LOG_LEVELS.HTTP]);
      expect(logger.levels[LOG_LEVELS.HTTP]).to.be.below(logger.levels[LOG_LEVELS.DEBUG]);
    });

    it("expone un método por nivel", () => {
      Object.values(LOG_LEVELS).forEach((level) => expect(logger[level]).to.be.a("function"));
    });

    it("en un entorno que no es producción el nivel mínimo es debug", () => {
      expect(config.isProduction).to.equal(false);
      expect(logger.level).to.equal(LOG_LEVELS.DEBUG);
    });
  });

  describe("Integración con el middleware de errores", () => {
    it("un error esperado (404) se registra como warning, con el código y la ruta", async () => {
      await request(app).get("/api/nada");

      const warning = captured.find((log) => log.level === LOG_LEVELS.WARNING);
      expect(warning, "no se registró ningún warning").to.exist;
      expect(warning.message).to.include("ROUTE_NOT_FOUND").and.include("GET /api/nada");
    });

    it("cantidad inválida en mocks se registra como warning", async () => {
      await request(app).get("/api/mocks/users?qty=-5");

      const warning = captured.find((log) => log.level === LOG_LEVELS.WARNING);
      expect(warning.message).to.include("INVALID_MOCK_AMOUNT");
    });

    it("las peticiones HTTP se registran en el nivel http", async () => {
      await request(app).get("/api/health");

      const http = captured.find((log) => log.level === LOG_LEVELS.HTTP);
      expect(http.message).to.match(/^GET \/api\/health 200 \d+ms$/);
    });

    it("crear una entidad registra un info (sin datos personales)", async () => {
      const admin = await createAdmin();
      captured.length = 0;

      await request(app)
        .post("/api/products")
        .set("Cookie", admin.cookie)
        .send({ name: "Bolsa", description: "d", category: "c", price: 1, stock: 1 });

      const info = captured.find((log) => log.level === LOG_LEVELS.INFO);
      expect(info.message).to.include("Producto creado");
    });
  });
});
