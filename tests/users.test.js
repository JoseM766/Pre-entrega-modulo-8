import { expect } from "chai";
import request from "supertest";
import app from "../src/app.js";
import { createAdmin, createCustomer, createDriver, NON_EXISTENT_ID } from "./helpers/factories.js";
import { expectError, expectUser, expectPage } from "./helpers/assertions.js";
import { USER_ROLES } from "../src/constants/index.js";

describe("Users", () => {
  describe("GET /api/users", () => {
    it("200: el admin obtiene el listado paginado de usuarios, sin contraseñas", async () => {
      const admin = await createAdmin();
      const customer = await createCustomer();
      const driver = await createDriver();

      const res = await request(app).get("/api/users").set("Cookie", admin.cookie);

      expect(res.status).to.equal(200);
      expectPage(res.body, { total: 3 });
      res.body.data.forEach(expectUser);
      expect(res.body.data.map((u) => u.id)).to.have.members([admin.id, customer.id, driver.id]);
      expect(res.body.data.map((u) => u.role)).to.have.members(Object.values(USER_ROLES));
    });

    it("200: filtra por rol", async () => {
      const admin = await createAdmin();
      await createCustomer();
      const driver = await createDriver();

      const res = await request(app).get(`/api/users?role=${USER_ROLES.DRIVER}`).set("Cookie", admin.cookie);

      expectPage(res.body, { total: 1 });
      expect(res.body.data[0].id).to.equal(driver.id);
    });

    it("200: pagina el listado (page y limit)", async () => {
      const admin = await createAdmin();
      await createCustomer();
      await createCustomer();
      await createCustomer();

      const res = await request(app).get("/api/users?limit=2&page=2").set("Cookie", admin.cookie);

      expectPage(res.body, { total: 4, page: 2 });
      expect(res.body.limit).to.equal(2);
      expect(res.body.totalPages).to.equal(2);
      expect(res.body.data).to.have.lengthOf(2);
    });

    it("400 INVALID_ROLE con un rol inexistente", async () => {
      const admin = await createAdmin();
      const res = await request(app).get("/api/users?role=superadmin").set("Cookie", admin.cookie);
      expectError(res, 400, "INVALID_ROLE");
    });

    it("401 UNAUTHORIZED sin sesión", async () => {
      const res = await request(app).get("/api/users");
      expectError(res, 401, "UNAUTHORIZED");
    });

    it("403 FORBIDDEN si el usuario no es admin", async () => {
      const customer = await createCustomer();
      const res = await request(app).get("/api/users").set("Cookie", customer.cookie);
      expectError(res, 403, "FORBIDDEN");
    });
  });

  describe("GET /api/users/:id", () => {
    it("200: el admin obtiene un usuario por id", async () => {
      const admin = await createAdmin();
      const customer = await createCustomer();

      const res = await request(app).get(`/api/users/${customer.id}`).set("Cookie", admin.cookie);

      expect(res.status).to.equal(200);
      expect(res.body.status).to.equal("success");
      expectUser(res.body.payload);
      expect(res.body.payload.id).to.equal(customer.id);
      expect(res.body.payload.email).to.equal(customer.user.email);
    });

    it("404 USER_NOT_FOUND con un id que no existe", async () => {
      const admin = await createAdmin();
      const res = await request(app).get(`/api/users/${NON_EXISTENT_ID}`).set("Cookie", admin.cookie);
      expectError(res, 404, "USER_NOT_FOUND");
    });

    it("404 USER_NOT_FOUND con un id mal formado", async () => {
      const admin = await createAdmin();
      const res = await request(app).get("/api/users/zzz").set("Cookie", admin.cookie);
      expectError(res, 404, "USER_NOT_FOUND");
    });

    it("401 UNAUTHORIZED sin sesión", async () => {
      const res = await request(app).get(`/api/users/${NON_EXISTENT_ID}`);
      expectError(res, 401, "UNAUTHORIZED");
    });

    it("403 FORBIDDEN si el usuario no es admin", async () => {
      const customer = await createCustomer();
      const res = await request(app).get(`/api/users/${customer.id}`).set("Cookie", customer.cookie);
      expectError(res, 403, "FORBIDDEN");
    });
  });
});
