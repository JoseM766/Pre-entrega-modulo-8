import { expect } from "chai";
import request from "supertest";
import app from "../src/app.js";
import { createAdmin, createCustomer, validProductBody, NON_EXISTENT_ID } from "./helpers/factories.js";
import { expectError, expectProduct, expectPage } from "./helpers/assertions.js";
import { PRODUCT_STATUS } from "../src/constants/index.js";

// Crea un producto real a través de la API (como admin) y devuelve el payload.
const createProduct = async (admin, overrides = {}) => {
  const res = await request(app).post("/api/products").set("Cookie", admin.cookie).send(validProductBody(overrides));
  return res.body.payload;
};

describe("Products", () => {
  describe("POST /api/products", () => {
    it("201: el admin crea un producto con estado available si tiene stock", async () => {
      const admin = await createAdmin();

      const res = await request(app).post("/api/products").set("Cookie", admin.cookie).send(validProductBody());

      expect(res.status).to.equal(201);
      expect(res.body.status).to.equal("success");
      expectProduct(res.body.payload);
      expect(res.body.payload).to.include({ name: "Bolsa courier", price: 150, stock: 200, status: PRODUCT_STATUS.AVAILABLE });
    });

    it("201: con stock 0 el estado se calcula solo como out_of_stock", async () => {
      const admin = await createAdmin();
      const res = await request(app).post("/api/products").set("Cookie", admin.cookie).send(validProductBody({ stock: 0 }));

      expect(res.status).to.equal(201);
      expect(res.body.payload.status).to.equal(PRODUCT_STATUS.OUT_OF_STOCK);
    });

    it("400 MISSING_FIELDS si faltan campos obligatorios", async () => {
      const admin = await createAdmin();
      const res = await request(app).post("/api/products").set("Cookie", admin.cookie).send({ name: "x" });
      expectError(res, 400, "MISSING_FIELDS");
    });

    it("400 INVALID_PRICE con precio negativo", async () => {
      const admin = await createAdmin();
      const res = await request(app).post("/api/products").set("Cookie", admin.cookie).send(validProductBody({ price: -1 }));
      expectError(res, 400, "INVALID_PRICE");
    });

    it("400 INVALID_STOCK con stock decimal", async () => {
      const admin = await createAdmin();
      const res = await request(app).post("/api/products").set("Cookie", admin.cookie).send(validProductBody({ stock: 1.5 }));
      expectError(res, 400, "INVALID_STOCK");
    });

    it("400 INVALID_JSON con un body que no es JSON", async () => {
      const admin = await createAdmin();
      const res = await request(app).post("/api/products").set("Cookie", admin.cookie).set("Content-Type", "application/json").send("{x");
      expectError(res, 400, "INVALID_JSON");
    });

    it("401 UNAUTHORIZED sin sesión", async () => {
      const res = await request(app).post("/api/products").send(validProductBody());
      expectError(res, 401, "UNAUTHORIZED");
    });

    it("403 FORBIDDEN si no es admin", async () => {
      const customer = await createCustomer();
      const res = await request(app).post("/api/products").set("Cookie", customer.cookie).send(validProductBody());
      expectError(res, 403, "FORBIDDEN");
    });

    it("409 PRODUCT_EXISTS si ya hay un producto con ese nombre", async () => {
      const admin = await createAdmin();
      await createProduct(admin);
      const res = await request(app).post("/api/products").set("Cookie", admin.cookie).send(validProductBody());
      expectError(res, 409, "PRODUCT_EXISTS");
    });
  });

  describe("GET /api/products", () => {
    it("200: listado paginado, por defecto solo productos available", async () => {
      const admin = await createAdmin();
      await createProduct(admin, { name: "Con stock" });
      await createProduct(admin, { name: "Agotado", stock: 0 });

      const res = await request(app).get("/api/products");

      expect(res.status).to.equal(200);
      expectPage(res.body, { total: 1 });
      res.body.data.forEach(expectProduct);
      expect(res.body.data[0].name).to.equal("Con stock");
    });

    it("200: ?status=out_of_stock muestra los agotados", async () => {
      const admin = await createAdmin();
      await createProduct(admin, { name: "Con stock" });
      await createProduct(admin, { name: "Agotado", stock: 0 });

      const res = await request(app).get("/api/products?status=out_of_stock");

      expectPage(res.body, { total: 1 });
      expect(res.body.data[0]).to.include({ name: "Agotado", status: PRODUCT_STATUS.OUT_OF_STOCK });
    });

    it("200: filtra por categoría, pagina y ordena", async () => {
      const admin = await createAdmin();
      await createProduct(admin, { name: "A", category: "embalaje", price: 100 });
      await createProduct(admin, { name: "B", category: "embalaje", price: 300 });
      await createProduct(admin, { name: "C", category: "insumos", price: 200 });

      const res = await request(app).get("/api/products?category=embalaje&limit=1&page=1&sort=-price");

      expectPage(res.body, { total: 2 });
      expect(res.body.limit).to.equal(1);
      expect(res.body.totalPages).to.equal(2);
      expect(res.body.data).to.have.lengthOf(1);
      expect(res.body.data[0].name).to.equal("B");
    });

    it("400 INVALID_SORT si se ordena por un campo no permitido", async () => {
      for (const sort of ["password", "-secret", "price,hack"]) {
        const res = await request(app).get(`/api/products?sort=${sort}`);
        expectError(res, 400, "INVALID_SORT");
        expect(res.body.message).to.include("name, price, stock, category, createdAt");
      }
    });

    it("400 INVALID_PRODUCT_STATUS con un estado inexistente", async () => {
      const res = await request(app).get("/api/products?status=foo");
      expectError(res, 400, "INVALID_PRODUCT_STATUS");
    });
  });

  describe("GET /api/products/:id", () => {
    it("200: devuelve el producto", async () => {
      const admin = await createAdmin();
      const product = await createProduct(admin);

      const res = await request(app).get(`/api/products/${product.id}`);

      expect(res.status).to.equal(200);
      expectProduct(res.body.payload);
      expect(res.body.payload.id).to.equal(product.id);
    });

    it("404 PRODUCT_NOT_FOUND con un id que no existe", async () => {
      const res = await request(app).get(`/api/products/${NON_EXISTENT_ID}`);
      expectError(res, 404, "PRODUCT_NOT_FOUND");
    });
  });

  describe("PUT /api/products/:id", () => {
    it("200: actualiza el producto y recalcula el estado según el stock", async () => {
      const admin = await createAdmin();
      const product = await createProduct(admin);

      const res = await request(app).put(`/api/products/${product.id}`).set("Cookie", admin.cookie).send({ stock: 0, price: 99 });

      expect(res.status).to.equal(200);
      expectProduct(res.body.payload);
      expect(res.body.payload).to.include({ stock: 0, price: 99, status: PRODUCT_STATUS.OUT_OF_STOCK });
    });

    it("200: ignora un status enviado a mano (se calcula solo)", async () => {
      const admin = await createAdmin();
      const product = await createProduct(admin);

      const res = await request(app).put(`/api/products/${product.id}`).set("Cookie", admin.cookie).send({ status: PRODUCT_STATUS.OUT_OF_STOCK });

      expect(res.status).to.equal(200);
      expect(res.body.payload.status).to.equal(PRODUCT_STATUS.AVAILABLE);
    });

    it("400 INVALID_PRICE con precio negativo", async () => {
      const admin = await createAdmin();
      const product = await createProduct(admin);
      const res = await request(app).put(`/api/products/${product.id}`).set("Cookie", admin.cookie).send({ price: -5 });
      expectError(res, 400, "INVALID_PRICE");
    });

    it("400 INVALID_STOCK con stock negativo", async () => {
      const admin = await createAdmin();
      const product = await createProduct(admin);
      const res = await request(app).put(`/api/products/${product.id}`).set("Cookie", admin.cookie).send({ stock: -1 });
      expectError(res, 400, "INVALID_STOCK");
    });

    it("400 INVALID_JSON con un body que no es JSON", async () => {
      const admin = await createAdmin();
      const product = await createProduct(admin);
      const res = await request(app).put(`/api/products/${product.id}`).set("Cookie", admin.cookie).set("Content-Type", "application/json").send("{x");
      expectError(res, 400, "INVALID_JSON");
    });

    it("401 UNAUTHORIZED sin sesión", async () => {
      const res = await request(app).put(`/api/products/${NON_EXISTENT_ID}`).send({ stock: 1 });
      expectError(res, 401, "UNAUTHORIZED");
    });

    it("403 FORBIDDEN si no es admin", async () => {
      const customer = await createCustomer();
      const res = await request(app).put(`/api/products/${NON_EXISTENT_ID}`).set("Cookie", customer.cookie).send({ stock: 1 });
      expectError(res, 403, "FORBIDDEN");
    });

    it("404 PRODUCT_NOT_FOUND con un id que no existe", async () => {
      const admin = await createAdmin();
      const res = await request(app).put(`/api/products/${NON_EXISTENT_ID}`).set("Cookie", admin.cookie).send({ stock: 1 });
      expectError(res, 404, "PRODUCT_NOT_FOUND");
    });
  });

  describe("DELETE /api/products/:id", () => {
    it("200: elimina el producto (y luego ya no existe)", async () => {
      const admin = await createAdmin();
      const product = await createProduct(admin);

      const res = await request(app).delete(`/api/products/${product.id}`).set("Cookie", admin.cookie);

      expect(res.status).to.equal(200);
      expect(res.body).to.deep.equal({ status: "success", message: "Producto eliminado" });

      const after = await request(app).get(`/api/products/${product.id}`);
      expectError(after, 404, "PRODUCT_NOT_FOUND");
    });

    it("401 UNAUTHORIZED sin sesión", async () => {
      const res = await request(app).delete(`/api/products/${NON_EXISTENT_ID}`);
      expectError(res, 401, "UNAUTHORIZED");
    });

    it("403 FORBIDDEN si no es admin", async () => {
      const customer = await createCustomer();
      const res = await request(app).delete(`/api/products/${NON_EXISTENT_ID}`).set("Cookie", customer.cookie);
      expectError(res, 403, "FORBIDDEN");
    });

    it("404 PRODUCT_NOT_FOUND con un id que no existe", async () => {
      const admin = await createAdmin();
      const res = await request(app).delete(`/api/products/${NON_EXISTENT_ID}`).set("Cookie", admin.cookie);
      expectError(res, 404, "PRODUCT_NOT_FOUND");
    });
  });
});
