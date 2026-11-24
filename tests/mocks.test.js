import { expect } from "chai";
import request from "supertest";
import app from "../src/app.js";
import User from "../src/models/User.js";
import * as usersRepository from "../src/repositories/users.repository.js";
import * as ordersRepository from "../src/repositories/orders.repository.js";
import * as deliveriesRepository from "../src/repositories/deliveries.repository.js";
import { createCustomer, createDriver } from "./helpers/factories.js";
import { expectError } from "./helpers/assertions.js";
import {
  USER_ROLES,
  ORDER_STATUS,
  DELIVERY_PRIORITY,
  DELIVERY_STATUS,
  ORDER_TO_DELIVERY_STATUS,
  MOCK_LIMITS,
} from "../src/constants/index.js";

const ALL_ORDERS = { filter: {}, skip: 0, limit: 100 };
const allUsers = async () => (await usersRepository.findUsers(ALL_ORDERS)).data;
const MOCK_ROLES = [USER_ROLES.USER, USER_ROLES.DRIVER];

describe("Mocks", () => {
  describe("GET /api/mocks/users (datos simulados, no se guardan)", () => {
    it("200: devuelve la cantidad pedida con la estructura y roles válidos", async () => {
      const res = await request(app).get("/api/mocks/users?qty=5");

      expect(res.status).to.equal(200);
      expect(res.body.status).to.equal("success");
      expect(res.body.payload).to.be.an("array").with.lengthOf(5);
      res.body.payload.forEach((user) => {
        expect(user).to.include.keys("first_name", "last_name", "email", "role");
        expect(user.email).to.match(/@test\.com$/);
        expect(MOCK_ROLES).to.include(user.role);
        expect(user).to.not.have.property("password");
        expect(user).to.not.have.property("id");
      });
    });

    it("200: por defecto genera 10", async () => {
      const res = await request(app).get("/api/mocks/users");
      expect(res.body.payload).to.have.lengthOf(MOCK_LIMITS.DEFAULT_QTY);
    });

    it("200: ?role=driver devuelve solo repartidores, con isAvailable", async () => {
      const res = await request(app).get("/api/mocks/users?qty=4&role=driver");

      expect(res.body.payload).to.have.lengthOf(4);
      res.body.payload.forEach((user) => {
        expect(user.role).to.equal(USER_ROLES.DRIVER);
        expect(user.isAvailable).to.be.a("boolean");
      });
    });

    it("200: el alias /mockingusers responde igual", async () => {
      const res = await request(app).get("/api/mocks/mockingusers?qty=2");
      expect(res.status).to.equal(200);
      expect(res.body.payload).to.have.lengthOf(2);
    });

    it("400 INVALID_MOCK_AMOUNT y INVALID_MOCK_ROLE también en el alias /mockingusers", async () => {
      expectError(await request(app).get("/api/mocks/mockingusers?qty=-3"), 400, "INVALID_MOCK_AMOUNT");
      expectError(await request(app).get("/api/mocks/mockingusers?role=admin"), 400, "INVALID_MOCK_ROLE");
    });

    it("NO guarda nada en la base", async () => {
      await request(app).get("/api/mocks/users?qty=5");
      await request(app).get("/api/mocks/orders?qty=5");
      await request(app).get("/api/mocks/deliveries?qty=5");

      expect(await allUsers()).to.have.lengthOf(0);
      expect((await ordersRepository.findOrders(ALL_ORDERS)).total).to.equal(0);
      expect((await deliveriesRepository.findDeliveries(ALL_ORDERS)).total).to.equal(0);
    });

    for (const [name, query] of [
      ["texto", "qty=abc"],
      ["decimal", "qty=2.5"],
      ["negativa", "qty=-5"],
      ["mayor al máximo", "qty=500"],
    ]) {
      it(`400 INVALID_MOCK_AMOUNT con cantidad ${name}`, async () => {
        const res = await request(app).get(`/api/mocks/users?${query}`);
        expectError(res, 400, "INVALID_MOCK_AMOUNT");
        expect(res.body.message).to.include("qty");
      });
    }

    it("400 INVALID_MOCK_ROLE con un rol no permitido (admin)", async () => {
      const res = await request(app).get("/api/mocks/users?role=admin");
      expectError(res, 400, "INVALID_MOCK_ROLE");
    });
  });

  describe("GET /api/mocks/orders", () => {
    it("200: pedidos simulados con estados y prioridades válidos, y total coherente", async () => {
      const res = await request(app).get("/api/mocks/orders?qty=6");

      expect(res.status).to.equal(200);
      expect(res.body.payload).to.have.lengthOf(6);
      res.body.payload.forEach((order) => {
        expect(order).to.include.keys("customer", "items", "deliveryAddress", "total", "status", "priority");
        expect(Object.values(ORDER_STATUS)).to.include(order.status);
        expect(Object.values(DELIVERY_PRIORITY)).to.include(order.priority);
        expect(order.items).to.be.an("array").that.is.not.empty;
        const sum = order.items.reduce((acc, item) => acc + item.quantity * item.price, 0);
        expect(order.total).to.equal(sum);
      });
    });

    it("200: el alias /mockingorders responde igual", async () => {
      const res = await request(app).get("/api/mocks/mockingorders?qty=2");
      expect(res.status).to.equal(200);
      expect(res.body.payload).to.have.lengthOf(2);
    });

    it("400 INVALID_MOCK_AMOUNT con cantidad negativa", async () => {
      expectError(await request(app).get("/api/mocks/orders?qty=-1"), 400, "INVALID_MOCK_AMOUNT");
    });

    it("400 INVALID_MOCK_AMOUNT en el alias /mockingorders", async () => {
      expectError(await request(app).get("/api/mocks/mockingorders?qty=x"), 400, "INVALID_MOCK_AMOUNT");
    });
  });

  describe("GET /api/mocks/deliveries", () => {
    it("200: entregas simuladas; cada una con su pedido, su repartidor y un estado válido", async () => {
      const res = await request(app).get("/api/mocks/deliveries?qty=4");

      expect(res.status).to.equal(200);
      expect(res.body.payload).to.have.lengthOf(4);
      res.body.payload.forEach((delivery) => {
        expect(delivery).to.have.all.keys("order", "driver", "status", "priority");
        expect(delivery.order).to.match(/^[0-9a-f]{24}$/);
        expect(delivery.driver).to.match(/^[0-9a-f]{24}$/);
        expect(Object.values(DELIVERY_STATUS)).to.include(delivery.status);
      });
    });

    it("400 INVALID_MOCK_AMOUNT con cantidad inválida", async () => {
      expectError(await request(app).get("/api/mocks/deliveries?qty=x"), 400, "INVALID_MOCK_AMOUNT");
    });
  });

  describe("POST /api/mocks/seed (inserta en MongoDB)", () => {
    it("201: inserta los usuarios, responde { insertados, coleccion } y quedan guardados", async () => {
      const res = await request(app).post("/api/mocks/seed?qty=4");

      expect(res.status).to.equal(201);
      expect(res.body).to.deep.equal({ insertados: 4, coleccion: "users" });

      const saved = await allUsers();
      expect(saved).to.have.lengthOf(4);
      saved.forEach((user) => {
        expect(MOCK_ROLES).to.include(user.role);
        expect(user).to.not.have.property("password"); // el repository no expone el hash
      });
    });

    it("201: con ?role=driver inserta solo repartidores", async () => {
      const res = await request(app).post("/api/mocks/seed?qty=3&role=driver");

      expect(res.body.insertados).to.equal(3);
      const saved = await allUsers();
      expect(saved.every((user) => user.role === USER_ROLES.DRIVER)).to.equal(true);
    });

    it("los usuarios insertados tienen la contraseña hasheada (se puede iniciar sesión con la de los mocks)", async () => {
      await request(app).post("/api/mocks/seed?qty=1");
      const [user] = await allUsers();

      const res = await request(app).post("/api/sessions/login").send({ email: user.email, password: "coder123" });

      expect(res.status).to.equal(200);
    });

    it("400 INVALID_MOCK_AMOUNT con cantidad negativa (y no inserta nada)", async () => {
      const res = await request(app).post("/api/mocks/seed?qty=-2");

      expectError(res, 400, "INVALID_MOCK_AMOUNT");
      expect(await allUsers()).to.have.lengthOf(0);
    });

    it("400 INVALID_MOCK_ROLE con un rol no permitido", async () => {
      expectError(await request(app).post("/api/mocks/seed?role=admin"), 400, "INVALID_MOCK_ROLE");
    });

    describe("falla de MongoDB durante la carga", () => {
      const originalInsertMany = User.insertMany;
      beforeEach(() => {
        User.insertMany = async () => {
          throw Object.assign(new Error("connection lost"), { name: "MongoNetworkError" });
        };
      });
      afterEach(() => {
        User.insertMany = originalInsertMany; // se restaura para no afectar a otros tests
      });

      it("500 MOCK_GENERATION_ERROR y no se filtra el error interno al cliente", async () => {
        const res = await request(app).post("/api/mocks/seed?qty=2");

        expectError(res, 500, "MOCK_GENERATION_ERROR");
        expect(res.body.message).to.not.include("connection lost");
      });
    });
  });

  describe("POST /api/mocks/generateData (inserta datos relacionados)", () => {
    it("201: crea usuarios, repartidores, pedidos y entregas con las relaciones correctas", async () => {
      const res = await request(app).post("/api/mocks/generateData").send({ users: 3, drivers: 2, orders: 6, deliveries: 4 });

      expect(res.status).to.equal(201);
      expect(res.body).to.deep.equal({ status: "success", insertados: { users: 3, drivers: 2, orders: 6, deliveries: 4 } });

      const customers = await usersRepository.findUsersByRole(USER_ROLES.USER);
      const drivers = await usersRepository.findUsersByRole(USER_ROLES.DRIVER);
      const { data: orders } = await ordersRepository.findOrders(ALL_ORDERS);
      const { data: deliveries } = await deliveriesRepository.findDeliveries(ALL_ORDERS);
      expect(customers).to.have.lengthOf(3);
      expect(drivers).to.have.lengthOf(2);
      expect(orders).to.have.lengthOf(6);
      expect(deliveries).to.have.lengthOf(4);

      const customerIds = customers.map((c) => String(c._id));
      const driverIds = drivers.map((d) => String(d._id));
      const orderById = new Map(orders.map((o) => [String(o._id), o]));

      // pedido ↔ cliente real
      orders.forEach((order) => expect(customerIds).to.include(String(order.customer)));
      deliveries.forEach((delivery) => {
        // entrega ↔ pedido real y repartidor con rol driver
        const order = orderById.get(String(delivery.order));
        expect(order, "la entrega apunta a un pedido existente").to.exist;
        expect(driverIds).to.include(String(delivery.driver));
        // el estado de la entrega es el que corresponde al del pedido
        expect(delivery.status).to.equal(ORDER_TO_DELIVERY_STATUS[order.status]);
        expect(delivery.priority).to.equal(order.priority);
      });
      // cada pedido tiene a lo sumo una entrega
      expect(new Set(deliveries.map((d) => String(d.order))).size).to.equal(4);
    });

    it("201: los pedidos usan clientes que ya existen cuando no se piden usuarios nuevos", async () => {
      const customer = await createCustomer();

      const res = await request(app).post("/api/mocks/generateData").send({ orders: 3 });

      expect(res.status).to.equal(201);
      expect(res.body.insertados).to.deep.equal({ users: 0, drivers: 0, orders: 3, deliveries: 0 });
      const { data: orders } = await ordersRepository.findOrders(ALL_ORDERS);
      orders.forEach((order) => expect(String(order.customer)).to.equal(customer.id));
    });

    it("201: las entregas usan repartidores que ya existen", async () => {
      const driver = await createDriver();
      await createCustomer();

      const res = await request(app).post("/api/mocks/generateData").send({ orders: 2, deliveries: 2 });

      expect(res.status).to.equal(201);
      const { data: deliveries } = await deliveriesRepository.findDeliveries(ALL_ORDERS);
      expect(deliveries).to.have.lengthOf(2);
      deliveries.forEach((delivery) => expect(String(delivery.driver)).to.equal(driver.id));
    });

    for (const [name, body] of [
      ["todas las cantidades en 0 o sin enviar", {}],
      ["un valor negativo", { users: -1 }],
      ["un valor de texto", { users: "muchos" }],
      ["un valor booleano", { users: true }],
      ["un valor decimal", { orders: 2.5 }],
      ["un valor mayor al máximo", { users: 101 }],
      ["más entregas que pedidos", { orders: 2, deliveries: 5 }],
    ]) {
      it(`400 INVALID_MOCK_AMOUNT con ${name}`, async () => {
        const res = await request(app).post("/api/mocks/generateData").send(body);
        expectError(res, 400, "INVALID_MOCK_AMOUNT");
        expect(await allUsers()).to.have.lengthOf(0);
      });
    }

    it("400 INVALID_JSON con un body que no es JSON", async () => {
      const res = await request(app).post("/api/mocks/generateData").set("Content-Type", "application/json").send("{x");
      expectError(res, 400, "INVALID_JSON");
    });

    it("400 MOCK_NO_CUSTOMERS si se piden pedidos y no hay clientes (no inserta nada)", async () => {
      const res = await request(app).post("/api/mocks/generateData").send({ orders: 2 });

      expectError(res, 400, "MOCK_NO_CUSTOMERS");
      expect((await ordersRepository.findOrders(ALL_ORDERS)).total).to.equal(0);
    });

    it("400 MOCK_NO_DRIVERS si se piden entregas y no hay repartidores (no inserta nada a medias)", async () => {
      const res = await request(app).post("/api/mocks/generateData").send({ users: 2, orders: 2, deliveries: 1 });

      expectError(res, 400, "MOCK_NO_DRIVERS");
      expect(await allUsers()).to.have.lengthOf(0);
      expect((await ordersRepository.findOrders(ALL_ORDERS)).total).to.equal(0);
    });

    describe("falla de MongoDB durante la carga", () => {
      const originalInsertMany = User.insertMany;
      beforeEach(() => {
        User.insertMany = async () => {
          throw Object.assign(new Error("connection lost"), { name: "MongoNetworkError" });
        };
      });
      afterEach(() => {
        User.insertMany = originalInsertMany;
      });

      it("500 MOCK_GENERATION_ERROR", async () => {
        expectError(await request(app).post("/api/mocks/generateData").send({ users: 2 }), 500, "MOCK_GENERATION_ERROR");
      });
    });
  });
});
