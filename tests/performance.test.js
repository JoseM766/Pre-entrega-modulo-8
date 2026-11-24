import fs from "node:fs";
import path from "node:path";
import { expect } from "chai";
import request from "supertest";
import app from "../src/app.js";
import Order from "../src/models/Order.js";
import Delivery from "../src/models/Delivery.js";
import Product from "../src/models/Product.js";
import User from "../src/models/User.js";
import { createAdmin, createCustomer, createDriver, createOrder, createDelivery } from "./helpers/factories.js";
import { expectError } from "./helpers/assertions.js";
import { PAGINATION } from "../src/constants/index.js";

describe("Performance y buenas prácticas", () => {
  describe("listados paginados (nunca devuelven la colección completa)", () => {
    it("GET /api/users: limit se limita al máximo y se informa el total y las páginas", async () => {
      const admin = await createAdmin();
      await Promise.all(Array.from({ length: 52 }, () => createCustomer()));

      const res = await request(app).get("/api/users?limit=1000").set("Cookie", admin.cookie);

      expect(res.status).to.equal(200);
      expect(res.body.limit).to.equal(PAGINATION.MAX_LIMIT);
      expect(res.body.data).to.have.lengthOf(PAGINATION.MAX_LIMIT);
      expect(res.body.total).to.equal(53);
      expect(res.body.totalPages).to.equal(2);
    });

    it("GET /api/users: sin parámetros usa la página 1 y el límite por defecto", async () => {
      const admin = await createAdmin();
      await Promise.all(Array.from({ length: 12 }, () => createCustomer()));

      const res = await request(app).get("/api/users").set("Cookie", admin.cookie);

      expect(res.body).to.include({ page: 1, limit: PAGINATION.DEFAULT_LIMIT, total: 13 });
      expect(res.body.data).to.have.lengthOf(PAGINATION.DEFAULT_LIMIT);
    });

    it("valores de page/limit inválidos (texto, 0, negativos) se corrigen sin fallar", async () => {
      const admin = await createAdmin();

      for (const query of ["page=abc&limit=xyz", "page=0&limit=0", "page=-3&limit=-5"]) {
        const res = await request(app).get(`/api/users?${query}`).set("Cookie", admin.cookie);
        expect(res.status, query).to.equal(200);
        expect(res.body.page, query).to.be.at.least(1);
        expect(res.body.limit, query).to.be.within(1, PAGINATION.MAX_LIMIT);
      }
    });

    it("pedidos, entregas y productos también respetan el máximo", async () => {
      const admin = await createAdmin();
      const customer = await createCustomer();
      const driver = await createDriver();
      const order = await createOrder(customer);
      await createDelivery(admin, order.id, driver.id);

      const orders = await request(app).get("/api/orders?limit=5000").set("Cookie", admin.cookie);
      const deliveries = await request(app).get("/api/deliveries?limit=5000").set("Cookie", admin.cookie);
      const products = await request(app).get("/api/products?limit=5000");

      for (const res of [orders, deliveries, products]) {
        expect(res.status).to.equal(200);
        expect(res.body.limit).to.equal(PAGINATION.MAX_LIMIT);
        expect(res.body).to.include.keys("data", "page", "total", "totalPages");
      }
    });

    it("los mocks tienen un máximo de cantidad (no generan datos sin control)", async () => {
      expectError(await request(app).get("/api/mocks/users?qty=100000"), 400, "INVALID_MOCK_AMOUNT");
    });

    it("el ordenamiento de productos solo admite campos permitidos (400 INVALID_SORT)", async () => {
      expectError(await request(app).get("/api/products?sort=password"), 400, "INVALID_SORT");
      const ok = await request(app).get("/api/products?sort=-price,name");
      expect(ok.status).to.equal(200);
    });
  });

  describe("índices de las colecciones (respaldan los filtros de los listados)", () => {
    const indexNames = async (model) => (await model.collection.indexes()).map((index) => index.name);

    it("pedidos: por cliente y por estado, ordenados por fecha", async () => {
      expect(await indexNames(Order)).to.include.members(["customer_1_createdAt_-1", "status_1_createdAt_-1"]);
    });

    it("entregas: por pedido (único), por repartidor y por estado", async () => {
      expect(await indexNames(Delivery)).to.include.members(["order_1", "driver_1_createdAt_-1", "status_1_createdAt_-1"]);
    });

    it("productos: por estado y categoría; nombre único", async () => {
      expect(await indexNames(Product)).to.include.members(["status_1_category_1", "name_1"]);
    });

    it("usuarios: por rol; email único", async () => {
      expect(await indexNames(User)).to.include.members(["role_1_createdAt_-1", "email_1"]);
    });
  });

  describe("tamaño de las respuestas y de las peticiones", () => {
    it("las respuestas grandes se comprimen con gzip", async () => {
      const res = await request(app).get("/api/docs/swagger-ui-init.js").set("Accept-Encoding", "gzip");

      expect(res.status).to.equal(200);
      expect(res.headers["content-encoding"]).to.equal("gzip");
    });

    it("un body JSON de más de 100 kb se rechaza con 413 PAYLOAD_TOO_LARGE (no con un 500)", async () => {
      const huge = { email: "a@a.com", password: "x".repeat(150 * 1024) };

      const res = await request(app).post("/api/sessions/login").send(huge);

      expectError(res, 413, "PAYLOAD_TOO_LARGE");
    });
  });

  describe("el Event Loop no se bloquea", () => {
    // Recorre src/ buscando operaciones sincrónicas del sistema de archivos.
    const SRC = path.join(process.cwd(), "src");
    const sourceFiles = (dir) =>
      fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) return sourceFiles(full);
        return full.endsWith(".js") ? [full] : [];
      });

    it("no hay operaciones sincrónicas de archivos en las peticiones (solo la creación de carpetas al arrancar)", () => {
      const withSync = sourceFiles(SRC).filter((file) => /\b\w+Sync\(/.test(fs.readFileSync(file, "utf8")));

      expect(withSync.map((file) => path.relative(SRC, file).split(path.sep).join("/"))).to.deep.equal(["config/multer.config.js"]);
    });

    it("las contraseñas se hashean con la versión asíncrona de bcrypt", () => {
      const hashFile = fs.readFileSync(path.join(SRC, "utils", "hash.js"), "utf8");
      expect(hashFile).to.not.match(/hashSync|compareSync/);
    });
  });
});
