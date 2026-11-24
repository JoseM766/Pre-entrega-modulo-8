import { expect } from "chai";
import request from "supertest";
import app from "../src/app.js";
import mongoose from "mongoose";
import { config } from "../src/config/index.js";
import { expectError } from "./helpers/assertions.js";

describe("Errores generales y health", () => {
  describe("GET /api/health", () => {
    it("200 con la estructura esperada: estado, entorno, uptime, timestamp y base de datos", async () => {
      const res = await request(app).get("/api/health");

      expect(res.status).to.equal(200);
      expect(res.body).to.have.all.keys("status", "environment", "uptime", "timestamp", "database");
      expect(res.body.status).to.equal("ok");
      expect(res.body.environment).to.equal("test");
      expect(res.body.uptime).to.be.a("number").that.is.at.least(0);
      expect(Number.isInteger(res.body.uptime)).to.equal(true);
      expect(Math.abs(Date.now() - new Date(res.body.timestamp).getTime())).to.be.below(5000);
      expect(res.body.database).to.equal("connected");
    });

    it("no expone información sensible (URI de la base, secretos, rutas internas)", async () => {
      const res = await request(app).get("/api/health");
      const text = JSON.stringify(res.body).toLowerCase();

      expect(text).to.not.include("mongodb");
      expect(text).to.not.include(config.jwt.secret.toLowerCase());
      expect(text).to.not.include(process.cwd().toLowerCase());
      expect(res.headers["x-powered-by"]).to.equal(undefined);
    });

    describe("sin conexión a la base de datos", () => {
      beforeEach(() => {
        // simula una conexión caída (readyState 0 = desconectado)
        Object.defineProperty(mongoose.connection, "readyState", { get: () => 0, configurable: true });
      });
      afterEach(() => {
        delete mongoose.connection.readyState; // vuelve a usar el valor real
      });

      it("503 con status degraded y database disconnected", async () => {
        const res = await request(app).get("/api/health");

        expect(res.status).to.equal(503);
        expect(res.body).to.include({ status: "degraded", database: "disconnected" });
        expect(res.body).to.have.all.keys("status", "environment", "uptime", "timestamp", "database");
      });
    });
  });

  describe("Ruta inexistente", () => {
    it("404 ROUTE_NOT_FOUND con la estructura de error uniforme (GET)", async () => {
      const res = await request(app).get("/api/nada");

      expectError(res, 404, "ROUTE_NOT_FOUND");
      // fuera de producción el error incluye details con el método y la ruta
      expect(res.body.details).to.equal("GET /api/nada");
    });

    it("404 ROUTE_NOT_FOUND también para otros métodos", async () => {
      const res = await request(app).delete("/api/users/algo/inexistente");
      expectError(res, 404, "ROUTE_NOT_FOUND");
      expect(res.body.details).to.equal("DELETE /api/users/algo/inexistente");
    });

    it("el error sale en JSON", async () => {
      const res = await request(app).get("/api/nada");
      expect(res.headers["content-type"]).to.match(/application\/json/);
    });
  });

  describe("JSON inválido en el body", () => {
    it("400 INVALID_JSON en cualquier endpoint que lea el body", async () => {
      const res = await request(app).post("/api/sessions/login").set("Content-Type", "application/json").send('{"email": ');
      expectError(res, 400, "INVALID_JSON");
    });
  });
});
