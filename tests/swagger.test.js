import { expect } from "chai";
import request from "supertest";
import app from "../src/app.js";
import { swaggerSpecs } from "../src/docs/swagger.config.js";
import { ERROR_DICTIONARY } from "../src/errors/index.js";

// Todas las operaciones documentadas: [{ method, path, operation }]
const documentedOperations = Object.entries(swaggerSpecs.paths).flatMap(([path, methods]) =>
  Object.entries(methods).map(([method, operation]) => ({ method, path, operation }))
);

// Rutas reales de Express, con el formato de Swagger (/api/orders/:id -> /api/orders/{id}).
// Usa la estructura interna de Express 4 (app._router.stack).
const getRealRoutes = () => {
  const routes = new Set();
  const walk = (stack, prefix) => {
    for (const layer of stack) {
      if (layer.route) {
        for (const routePath of [].concat(layer.route.path)) {
          for (const method of Object.keys(layer.route.methods)) {
            routes.add(`${method} ${prefix}${routePath === "/" ? "" : routePath}`.replace(/:(\w+)/g, "{$1}"));
          }
        }
      } else if (layer.name === "router") {
        const mount = layer.regexp.source.replace("^\\", "").replace("\\/?(?=\\/|$)", "").replace(/\\\//g, "/");
        walk(layer.handle.stack, prefix + mount);
      }
    }
  };
  walk(app._router.stack, "");
  return [...routes].filter((route) => !route.includes("/api/docs"));
};

describe("Swagger", () => {
  describe("GET /api/docs", () => {
    it("200: Swagger UI se sirve como HTML", async () => {
      const res = await request(app).get("/api/docs/");

      expect(res.status).to.equal(200);
      expect(res.headers["content-type"]).to.match(/text\/html/);
      expect(res.text).to.include("swagger-ui");
      expect(res.text).to.include("ShipNow API Docs");
    });

    it("sirve los archivos estáticos de la interfaz", async () => {
      const res = await request(app).get("/api/docs/swagger-ui-init.js");

      expect(res.status).to.equal(200);
      expect(res.headers["content-type"]).to.match(/javascript/);
    });

    it("/api/docs sin la barra final redirige a /api/docs/", async () => {
      const res = await request(app).get("/api/docs");

      expect(res.status).to.be.oneOf([301, 302]);
      expect(res.headers.location).to.match(/\/api\/docs\/$/);
    });
  });

  describe("Contenido de la especificación", () => {
    it("tiene la información general: nombre, versión, descripción y servidor local", () => {
      expect(swaggerSpecs.openapi).to.match(/^3\./);
      expect(swaggerSpecs.info.title).to.equal("ShipNow API");
      expect(swaggerSpecs.info.version).to.be.a("string").that.is.not.empty;
      expect(swaggerSpecs.info.description).to.be.a("string").that.is.not.empty;
      expect(swaggerSpecs.servers[0].url).to.match(/^http:\/\/localhost:\d+$/);
    });

    it("agrupa la documentación en los tags Users, Orders, Deliveries, Mocks y Logger", () => {
      const tagNames = swaggerSpecs.tags.map((tag) => tag.name);
      expect(tagNames).to.include.members(["Users", "Orders", "Deliveries", "Mocks", "Logger"]);
    });

    it("cada operación documentada pertenece a un tag declarado, y tiene resumen, descripción, respuesta exitosa y error 500", () => {
      const tagNames = swaggerSpecs.tags.map((tag) => tag.name);
      documentedOperations.forEach(({ method, path, operation }) => {
        const label = `${method.toUpperCase()} ${path}`;
        expect(tagNames, label).to.include.members(operation.tags);
        expect(operation.summary, label).to.be.a("string").that.is.not.empty;
        expect(operation.description, label).to.be.a("string").that.is.not.empty;
        expect(Object.keys(operation.responses).some((status) => status.startsWith("2")), label).to.equal(true);
        // /api/health no consulta nada y no tiene cómo fallar: es el único que no documenta un error 500.
        if (path !== "/api/health") expect(operation.responses, label).to.have.property("500");
      });
    });

    it("define los schemas reutilizables: usuario, pedido, entrega, item de pedido, error y éxito", () => {
      expect(swaggerSpecs.components.schemas).to.include.keys("User", "Order", "Delivery", "OrderItem", "ErrorResponse", "SuccessResponse");
    });

    it("el schema ErrorResponse tiene el formato del módulo de errores", () => {
      const schema = swaggerSpecs.components.schemas.ErrorResponse;
      expect(schema.required).to.have.members(["status", "error", "message"]);
      expect(schema.properties).to.include.keys("status", "error", "message", "details");
    });

    describe("endpoints de carga de archivos", () => {
      const multipartSchema = (path) => swaggerSpecs.paths[path].post.requestBody.content["multipart/form-data"].schema;

      it("POST /api/users/{id}/documents se documenta como multipart/form-data, con el campo document y los tipos de documento permitidos", () => {
        const schema = multipartSchema("/api/users/{id}/documents");

        expect(schema.required).to.deep.equal(["document"]);
        expect(schema.properties.document).to.include({ type: "string", format: "binary" });
        expect(schema.properties.type.enum).to.have.members(["user_document", "driver_license"]);
        expect(schema.properties.type.default).to.equal("user_document");
      });

      it("POST /api/orders/{id}/proof se documenta como multipart/form-data, con el campo proof", () => {
        const schema = multipartSchema("/api/orders/{id}/proof");

        expect(schema.required).to.deep.equal(["proof"]);
        expect(schema.properties.proof).to.include({ type: "string", format: "binary" });
      });

      it("documentan los errores de archivos con sus status: 400, 413 y 500", () => {
        for (const path of ["/api/users/{id}/documents", "/api/orders/{id}/proof"]) {
          const responses = swaggerSpecs.paths[path].post.responses;
          const codesOf = (status) => Object.keys(responses[status].content["application/json"].examples);

          expect(codesOf("400"), path).to.include.members(["FILE_REQUIRED", "INVALID_FILE_TYPE", "INVALID_FILE_FIELD"]);
          expect(codesOf("413"), path).to.deep.equal(["FILE_TOO_LARGE"]);
          expect(codesOf("500"), path).to.include("UPLOAD_ERROR");
        }
        expect(Object.keys(swaggerSpecs.paths["/api/users/{id}/documents"].post.responses["400"].content["application/json"].examples)).to.include("INVALID_DOCUMENT_TYPE");
      });

      it("el schema FileMetadata describe los metadatos que se guardan (sin el contenido del archivo)", () => {
        const properties = swaggerSpecs.components.schemas.FileMetadata.properties;
        expect(properties).to.have.all.keys("originalName", "fileName", "path", "mimeType", "size", "type", "uploadedAt");
        expect(swaggerSpecs.components.schemas.Order.properties).to.include.key("proofs");
      });

      it("documentan los formatos y el tamaño máximo permitidos", () => {
        for (const path of ["/api/users/{id}/documents", "/api/orders/{id}/proof"]) {
          expect(swaggerSpecs.paths[path].post.description, path).to.include("5 MB").and.include("application/pdf");
        }
      });
    });

    it("documenta el endpoint del logger aclarando que no es funcionalidad de negocio", () => {
      const operation = swaggerSpecs.paths["/api/loggerTest"].get;
      expect(operation.tags).to.deep.equal(["Logger"]);
      expect(operation.description).to.match(/no es una funcionalidad de negocio/i);
    });
  });

  describe("Coherencia: la documentación coincide con la API real", () => {
    it("todas las rutas reales (salvo /api/docs) están documentadas", () => {
      const documented = documentedOperations.map(({ method, path }) => `${method} ${path}`);
      const undocumented = getRealRoutes().filter((route) => !documented.includes(route));
      expect(undocumented, `rutas sin documentar: ${undocumented.join(", ")}`).to.deep.equal([]);
    });

    it("todas las rutas documentadas existen en la API", () => {
      const real = getRealRoutes();
      const missing = documentedOperations.map(({ method, path }) => `${method} ${path}`).filter((route) => !real.includes(route));
      expect(missing, `documentadas pero inexistentes: ${missing.join(", ")}`).to.deep.equal([]);
    });

    it("cada operación documentada responde algo distinto de ROUTE_NOT_FOUND", async () => {
      for (const { method, path } of documentedOperations) {
        const url = path.replace(/\{\w+\}/g, "0".repeat(24));
        const res = await request(app)[method](url);
        expect(res.body.error, `${method.toUpperCase()} ${path}`).to.not.equal("ROUTE_NOT_FOUND");
      }
    });

    it("cada error documentado existe en el diccionario de errores con el mismo status HTTP", () => {
      documentedOperations.forEach(({ method, path, operation }) => {
        Object.entries(operation.responses).forEach(([status, response]) => {
          const examples = response.content?.["application/json"]?.examples ?? {};
          Object.entries(examples).forEach(([code, example]) => {
            const label = `${method.toUpperCase()} ${path} ${status} ${code}`;
            expect(ERROR_DICTIONARY, label).to.have.property(code);
            expect(ERROR_DICTIONARY[code].status, label).to.equal(Number(status));
            expect(example.value, label).to.deep.include({ status: "error", error: code });
            expect(swaggerSpecs.components.schemas.ErrorResponse.properties.error.enum, label).to.include(code);
          });
        });
      });
    });

    it("el ErrorResponse documenta exactamente los códigos del diccionario de errores", () => {
      expect(swaggerSpecs.components.schemas.ErrorResponse.properties.error.enum).to.have.members(Object.keys(ERROR_DICTIONARY));
    });
  });
});
