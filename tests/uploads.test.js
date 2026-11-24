import { expect } from "chai";
import fsPromises from "node:fs/promises";
import request from "supertest";
import app from "../src/app.js";
import User from "../src/models/User.js";
import Order from "../src/models/Order.js";
import { config } from "../src/config/index.js";
import { createAdmin, createCustomer, createDriver, createOrder, createDelivery, NON_EXISTENT_ID } from "./helpers/factories.js";
import { expectError, expectOrder } from "./helpers/assertions.js";
import {
  pdfBuffer,
  pngBuffer,
  jpegBuffer,
  maxSizePdf,
  oversizedPdf,
  PDF,
  PNG,
  JPG,
  listUploadedFiles,
  fileExists,
} from "./helpers/files.js";
import { DOCUMENT_TYPES, FILE_UPLOAD } from "../src/constants/index.js";

const UPLOADS = config.uploads.dir; // "uploads/test" durante los tests
const FILE_NAME = /^\d+-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.\w+$/;

// Verifica la estructura de los metadatos que devuelve la API.
const expectFileMetadata = (file, { originalName, type, folder, mimeType, size }) => {
  expect(file).to.have.all.keys("originalName", "fileName", "path", "mimeType", "size", "type", "uploadedAt");
  expect(file.originalName).to.equal(originalName);
  expect(file.fileName).to.match(FILE_NAME).and.to.not.equal(originalName);
  expect(file.path).to.equal(`${UPLOADS}/${folder}/${file.fileName}`);
  expect(file.mimeType).to.equal(mimeType);
  expect(file.size).to.equal(size);
  expect(file.type).to.equal(type);
  expect(new Date(file.uploadedAt).toString()).to.not.equal("Invalid Date");
};

const uploadDocument = (cookie, userId, buffer = pdfBuffer(), fileOptions = PDF) =>
  request(app).post(`/api/users/${userId}/documents`).set("Cookie", cookie).attach("document", buffer, fileOptions);

describe("Carga de archivos", () => {
  describe("POST /api/users/:id/documents", () => {
    describe("casos exitosos", () => {
      it("201: el usuario sube un PDF; se guarda en uploads/documents y se registran los metadatos", async () => {
        const customer = await createCustomer();
        const buffer = pdfBuffer(2048);

        const res = await uploadDocument(customer.cookie, customer.id, buffer);

        expect(res.status).to.equal(201);
        expect(res.body.status).to.equal("success");
        expect(res.body.message).to.equal("Documento cargado correctamente");
        expect(res.body.payload.id).to.equal(customer.id);
        expect(res.body.payload.documents).to.have.lengthOf(1);
        expectFileMetadata(res.body.payload.documents[0], {
          originalName: "dni.pdf",
          type: DOCUMENT_TYPES.USER_DOCUMENT, // por defecto, si no se envía "type"
          folder: "documents",
          mimeType: "application/pdf",
          size: buffer.length,
        });
        // el archivo existe de verdad en el servidor
        expect(fileExists(res.body.payload.documents[0].path)).to.equal(true);
      });

      it("los metadatos quedan guardados en el usuario (se pueden consultar después)", async () => {
        const customer = await createCustomer();
        const uploaded = await uploadDocument(customer.cookie, customer.id);

        const res = await request(app).get(`/api/users/${customer.id}/documents`).set("Cookie", customer.cookie);

        expect(res.status).to.equal(200);
        expect(res.body.payload.documents).to.deep.equal(uploaded.body.payload.documents);
      });

      it("201: con type=driver_license el archivo se guarda en uploads/licenses (y no queda en documents)", async () => {
        const driver = await createDriver();

        const res = await uploadDocument(driver.cookie, driver.id).field("type", DOCUMENT_TYPES.DRIVER_LICENSE);

        expect(res.status).to.equal(201);
        const [doc] = res.body.payload.documents;
        expectFileMetadata(doc, {
          originalName: "dni.pdf",
          type: DOCUMENT_TYPES.DRIVER_LICENSE,
          folder: "licenses",
          mimeType: "application/pdf",
          size: pdfBuffer().length,
        });
        expect(fileExists(doc.path)).to.equal(true);
        expect(listUploadedFiles().filter((file) => file.includes("documents"))).to.have.lengthOf(0);
      });

      it("201: acepta imágenes JPG y PNG", async () => {
        const customer = await createCustomer();

        const png = await uploadDocument(customer.cookie, customer.id, pngBuffer(), PNG);
        const jpg = await uploadDocument(customer.cookie, customer.id, jpegBuffer(), JPG);

        expect(png.status).to.equal(201);
        expect(jpg.status).to.equal(201);
        const docs = jpg.body.payload.documents;
        expect(docs.map((d) => d.mimeType)).to.deep.equal(["image/png", "image/jpeg"]);
        expect(docs[0].fileName).to.match(/\.png$/);
        expect(docs[1].fileName).to.match(/\.jpg$/);
      });

      it("201: acepta un archivo de exactamente el tamaño máximo permitido", async () => {
        const customer = await createCustomer();
        const buffer = maxSizePdf();
        expect(buffer.length).to.equal(FILE_UPLOAD.MAX_SIZE_BYTES);

        const res = await uploadDocument(customer.cookie, customer.id, buffer);

        expect(res.status).to.equal(201);
        expect(res.body.payload.documents[0].size).to.equal(FILE_UPLOAD.MAX_SIZE_BYTES);
      });

      it("201: el admin puede subir un documento a otro usuario", async () => {
        const admin = await createAdmin();
        const customer = await createCustomer();

        const res = await uploadDocument(admin.cookie, customer.id);

        expect(res.status).to.equal(201);
        expect(res.body.payload.id).to.equal(customer.id);
      });

      it("varios documentos se acumulan, sin pisarse, y cada uno tiene su propio nombre generado", async () => {
        const customer = await createCustomer();

        await uploadDocument(customer.cookie, customer.id);
        const res = await uploadDocument(customer.cookie, customer.id); // mismo nombre original

        const docs = res.body.payload.documents;
        expect(docs).to.have.lengthOf(2);
        expect(docs[0].originalName).to.equal(docs[1].originalName);
        expect(docs[0].fileName).to.not.equal(docs[1].fileName);
        expect(listUploadedFiles()).to.have.lengthOf(2);
      });

      it("un nombre de archivo malicioso no afecta dónde se guarda (el nombre lo genera el servidor)", async () => {
        const customer = await createCustomer();

        const res = await uploadDocument(customer.cookie, customer.id, pdfBuffer(), {
          filename: "../../evil.pdf",
          contentType: "application/pdf",
        });

        expect(res.status).to.equal(201);
        const [doc] = res.body.payload.documents;
        expect(doc.originalName).to.equal("evil.pdf");
        expect(doc.path).to.equal(`${UPLOADS}/documents/${doc.fileName}`);
        expect(listUploadedFiles()).to.have.lengthOf(1);
      });

      it("conserva los acentos y la ñ del nombre original", async () => {
        const customer = await createCustomer();

        const res = await uploadDocument(customer.cookie, customer.id, pdfBuffer(), {
          filename: "comprobante ñandú.pdf",
          contentType: "application/pdf",
        });

        expect(res.status).to.equal(201);
        expect(res.body.payload.documents[0].originalName).to.equal("comprobante ñandú.pdf");
      });
    });

    describe("errores", () => {
      it("400 FILE_REQUIRED si no se envía ningún archivo", async () => {
        const customer = await createCustomer();

        const res = await request(app).post(`/api/users/${customer.id}/documents`).set("Cookie", customer.cookie).field("type", DOCUMENT_TYPES.USER_DOCUMENT);

        expectError(res, 400, "FILE_REQUIRED");
      });

      it("400 FILE_REQUIRED si la petición no es multipart (por ejemplo, un JSON)", async () => {
        const customer = await createCustomer();

        const res = await request(app).post(`/api/users/${customer.id}/documents`).set("Cookie", customer.cookie).send({ type: DOCUMENT_TYPES.USER_DOCUMENT });

        expectError(res, 400, "FILE_REQUIRED");
      });

      for (const [name, buffer, options] of [
        ["un GIF", Buffer.from("GIF89a"), { filename: "animacion.gif", contentType: "image/gif" }],
        ["un archivo de texto", Buffer.from("hola"), { filename: "notas.txt", contentType: "text/plain" }],
        ["un ejecutable", Buffer.from("MZ"), { filename: "virus.exe", contentType: "application/octet-stream" }],
        ["un MIME type permitido con extensión no permitida", pdfBuffer(), { filename: "dni.exe", contentType: "application/pdf" }],
        ["una extensión permitida con un MIME type no permitido", pdfBuffer(), { filename: "dni.pdf", contentType: "text/html" }],
      ]) {
        it(`400 INVALID_FILE_TYPE al subir ${name} (y no se guarda nada)`, async () => {
          const customer = await createCustomer();

          const res = await uploadDocument(customer.cookie, customer.id, buffer, options);

          expectError(res, 400, "INVALID_FILE_TYPE");
          expect(res.body.message).to.include("application/pdf");
          expect(listUploadedFiles()).to.have.lengthOf(0);
        });
      }

      it("400 INVALID_FILE_FIELD si el archivo viene en un campo con otro nombre", async () => {
        const customer = await createCustomer();

        const res = await request(app).post(`/api/users/${customer.id}/documents`).set("Cookie", customer.cookie).attach("file", pdfBuffer(), PDF);

        expectError(res, 400, "INVALID_FILE_FIELD");
        expect(res.body.message).to.include('"document"');
        expect(listUploadedFiles()).to.have.lengthOf(0);
      });

      it("400 INVALID_FILE_FIELD si se envía más de un archivo", async () => {
        const customer = await createCustomer();

        const res = await request(app)
          .post(`/api/users/${customer.id}/documents`)
          .set("Cookie", customer.cookie)
          .attach("document", pdfBuffer(), PDF)
          .attach("document", pdfBuffer(), PDF);

        expectError(res, 400, "INVALID_FILE_FIELD");
        expect(listUploadedFiles()).to.have.lengthOf(0);
      });

      it("413 FILE_TOO_LARGE si el archivo supera el tamaño máximo (y no se guarda nada)", async () => {
        const customer = await createCustomer();

        const res = await uploadDocument(customer.cookie, customer.id, oversizedPdf());

        expectError(res, 413, "FILE_TOO_LARGE");
        expect(res.body.message).to.include("5 MB");
        expect(listUploadedFiles()).to.have.lengthOf(0);
      });

      it("400 INVALID_DOCUMENT_TYPE con un tipo de documento inexistente (y se borra el archivo)", async () => {
        const customer = await createCustomer();

        const res = await uploadDocument(customer.cookie, customer.id).field("type", "pasaporte");

        expectError(res, 400, "INVALID_DOCUMENT_TYPE");
        expect(res.body.message).to.include(DOCUMENT_TYPES.USER_DOCUMENT).and.include(DOCUMENT_TYPES.DRIVER_LICENSE);
        expect(listUploadedFiles()).to.have.lengthOf(0);
      });

      it("400 INVALID_DOCUMENT_TYPE si se usa delivery_proof (es solo para comprobantes)", async () => {
        const customer = await createCustomer();

        const res = await uploadDocument(customer.cookie, customer.id).field("type", DOCUMENT_TYPES.DELIVERY_PROOF);

        expectError(res, 400, "INVALID_DOCUMENT_TYPE");
        expect(listUploadedFiles()).to.have.lengthOf(0);
      });

      it("404 USER_NOT_FOUND si el usuario no existe (y no queda el archivo)", async () => {
        const admin = await createAdmin();

        const res = await uploadDocument(admin.cookie, NON_EXISTENT_ID);

        expectError(res, 404, "USER_NOT_FOUND");
        expect(listUploadedFiles()).to.have.lengthOf(0);
      });

      it("401 UNAUTHORIZED sin sesión (y no se guarda nada)", async () => {
        const customer = await createCustomer();

        const res = await request(app).post(`/api/users/${customer.id}/documents`).attach("document", pdfBuffer(), PDF);

        expectError(res, 401, "UNAUTHORIZED");
        expect(listUploadedFiles()).to.have.lengthOf(0);
      });

      it("403 FORBIDDEN si intenta subir un documento a otro usuario (y no queda el archivo)", async () => {
        const customer = await createCustomer();
        const other = await createCustomer();

        const res = await uploadDocument(customer.cookie, other.id);

        expectError(res, 403, "FORBIDDEN");
        expect(listUploadedFiles()).to.have.lengthOf(0);
      });

      describe("fallas al guardar", () => {
        const originalRename = fsPromises.rename;
        const originalFindByIdAndUpdate = User.findByIdAndUpdate;
        afterEach(() => {
          fsPromises.rename = originalRename; // se restauran para no afectar a otros tests
          User.findByIdAndUpdate = originalFindByIdAndUpdate;
        });

        it("500 UPLOAD_ERROR si no se puede mover el archivo a su carpeta (y no queda el archivo)", async () => {
          const driver = await createDriver();
          fsPromises.rename = async () => {
            throw new Error("EACCES: permission denied");
          };

          const res = await uploadDocument(driver.cookie, driver.id).field("type", DOCUMENT_TYPES.DRIVER_LICENSE);

          expectError(res, 500, "UPLOAD_ERROR");
          expect(res.body.message).to.not.include("EACCES"); // el detalle interno no se filtra al cliente
          expect(listUploadedFiles()).to.have.lengthOf(0);
        });

        it("500 DATABASE_ERROR si falla la base al registrar los metadatos (y se borra el archivo)", async () => {
          const customer = await createCustomer();
          User.findByIdAndUpdate = () => {
            throw Object.assign(new Error("connection lost"), { name: "MongoNetworkError" });
          };

          const res = await uploadDocument(customer.cookie, customer.id);

          expectError(res, 500, "DATABASE_ERROR");
          expect(listUploadedFiles()).to.have.lengthOf(0);
        });
      });
    });
  });

  describe("GET /api/users/:id/documents", () => {
    it("200: lista vacía si el usuario todavía no subió documentos", async () => {
      const customer = await createCustomer();

      const res = await request(app).get(`/api/users/${customer.id}/documents`).set("Cookie", customer.cookie);

      expect(res.status).to.equal(200);
      expect(res.body).to.deep.equal({ status: "success", payload: { id: customer.id, documents: [] } });
    });

    it("200: el admin ve los documentos de cualquier usuario", async () => {
      const admin = await createAdmin();
      const customer = await createCustomer();
      await uploadDocument(customer.cookie, customer.id);

      const res = await request(app).get(`/api/users/${customer.id}/documents`).set("Cookie", admin.cookie);

      expect(res.status).to.equal(200);
      expect(res.body.payload.documents).to.have.lengthOf(1);
    });

    it("401 UNAUTHORIZED sin sesión", async () => {
      const res = await request(app).get(`/api/users/${NON_EXISTENT_ID}/documents`);
      expectError(res, 401, "UNAUTHORIZED");
    });

    it("403 FORBIDDEN si son los documentos de otro usuario", async () => {
      const customer = await createCustomer();
      const other = await createCustomer();
      const res = await request(app).get(`/api/users/${other.id}/documents`).set("Cookie", customer.cookie);
      expectError(res, 403, "FORBIDDEN");
    });

    it("404 USER_NOT_FOUND si el usuario no existe", async () => {
      const admin = await createAdmin();
      const res = await request(app).get(`/api/users/${NON_EXISTENT_ID}/documents`).set("Cookie", admin.cookie);
      expectError(res, 404, "USER_NOT_FOUND");
    });
  });

  describe("POST /api/orders/:id/proof (comprobante de entrega)", () => {
    // Escenario: un pedido de un cliente, asignado a un repartidor.
    const setup = async () => {
      const admin = await createAdmin();
      const customer = await createCustomer();
      const driver = await createDriver();
      const order = await createOrder(customer);
      await createDelivery(admin, order.id, driver.id);
      return { admin, customer, driver, order };
    };

    const uploadProof = (cookie, orderId, buffer = pngBuffer(), fileOptions = PNG) =>
      request(app).post(`/api/orders/${orderId}/proof`).set("Cookie", cookie).attach("proof", buffer, fileOptions);

    describe("casos exitosos", () => {
      it("201: el repartidor asignado sube el comprobante; se guarda en uploads/proofs y se asocia al pedido", async () => {
        const { driver, order } = await setup();
        const buffer = pngBuffer();

        const res = await uploadProof(driver.cookie, order.id, buffer);

        expect(res.status).to.equal(201);
        expect(res.body.status).to.equal("success");
        expect(res.body.message).to.equal("Comprobante cargado correctamente");
        // devuelve el pedido actualizado, con su comprobante
        expectOrder(res.body.payload);
        expect(res.body.payload.id).to.equal(order.id);
        expect(res.body.payload.proofs).to.have.lengthOf(1);
        expectFileMetadata(res.body.payload.proofs[0], {
          originalName: "comprobante.png",
          type: DOCUMENT_TYPES.DELIVERY_PROOF,
          folder: "proofs",
          mimeType: "image/png",
          size: buffer.length,
        });
        expect(fileExists(res.body.payload.proofs[0].path)).to.equal(true);
      });

      it("el comprobante queda guardado en el pedido: el cliente lo ve al consultar su pedido", async () => {
        const { customer, driver, order } = await setup();
        const uploaded = await uploadProof(driver.cookie, order.id);

        const res = await request(app).get(`/api/orders/${order.id}`).set("Cookie", customer.cookie);

        expect(res.status).to.equal(200);
        expect(res.body.payload.proofs).to.deep.equal(uploaded.body.payload.proofs);
      });

      it("un pedido sin comprobantes tiene proofs vacío", async () => {
        const customer = await createCustomer();
        const order = await createOrder(customer);
        expect(order.proofs).to.deep.equal([]);
      });

      it("201: el admin también puede subir un comprobante", async () => {
        const { admin, order } = await setup();

        const res = await uploadProof(admin.cookie, order.id, pdfBuffer(), PDF);

        expect(res.status).to.equal(201);
        expect(res.body.payload.proofs[0].mimeType).to.equal("application/pdf");
      });

      it("201: el admin puede subir un comprobante aunque el pedido no tenga entrega asignada", async () => {
        const admin = await createAdmin();
        const order = await createOrder(await createCustomer());

        const res = await uploadProof(admin.cookie, order.id);

        expect(res.status).to.equal(201);
      });

      it("varios comprobantes se acumulan en el pedido", async () => {
        const { driver, order } = await setup();

        await uploadProof(driver.cookie, order.id);
        const res = await uploadProof(driver.cookie, order.id);

        expect(res.body.payload.proofs).to.have.lengthOf(2);
        expect(listUploadedFiles()).to.have.lengthOf(2);
      });
    });

    describe("errores", () => {
      it("400 FILE_REQUIRED si no se envía el archivo", async () => {
        const { driver, order } = await setup();
        const res = await request(app).post(`/api/orders/${order.id}/proof`).set("Cookie", driver.cookie);
        expectError(res, 400, "FILE_REQUIRED");
      });

      it("400 INVALID_FILE_TYPE con un tipo de archivo no permitido (y no se guarda nada)", async () => {
        const { driver, order } = await setup();

        const res = await uploadProof(driver.cookie, order.id, Buffer.from("GIF89a"), { filename: "foto.gif", contentType: "image/gif" });

        expectError(res, 400, "INVALID_FILE_TYPE");
        expect(listUploadedFiles()).to.have.lengthOf(0);
      });

      it("400 INVALID_FILE_FIELD si el archivo viene en un campo con otro nombre", async () => {
        const { driver, order } = await setup();

        const res = await request(app).post(`/api/orders/${order.id}/proof`).set("Cookie", driver.cookie).attach("document", pngBuffer(), PNG);

        expectError(res, 400, "INVALID_FILE_FIELD");
        expect(res.body.message).to.include('"proof"');
      });

      it("413 FILE_TOO_LARGE si el archivo supera el tamaño máximo (y no se guarda nada)", async () => {
        const { driver, order } = await setup();

        const res = await uploadProof(driver.cookie, order.id, oversizedPdf(), PDF);

        expectError(res, 413, "FILE_TOO_LARGE");
        expect(listUploadedFiles()).to.have.lengthOf(0);
      });

      it("401 UNAUTHORIZED sin sesión", async () => {
        const { order } = await setup();
        const res = await request(app).post(`/api/orders/${order.id}/proof`).attach("proof", pngBuffer(), PNG);
        expectError(res, 401, "UNAUTHORIZED");
        expect(listUploadedFiles()).to.have.lengthOf(0);
      });

      it("403 FORBIDDEN si es un cliente (y no queda el archivo)", async () => {
        const { customer, order } = await setup();

        const res = await uploadProof(customer.cookie, order.id);

        expectError(res, 403, "FORBIDDEN");
        expect(listUploadedFiles()).to.have.lengthOf(0);
      });

      it("403 FORBIDDEN si el repartidor NO es el asignado a ese pedido (y no queda el archivo)", async () => {
        const { order } = await setup();
        const otherDriver = await createDriver();

        const res = await uploadProof(otherDriver.cookie, order.id);

        expectError(res, 403, "FORBIDDEN");
        expect(listUploadedFiles()).to.have.lengthOf(0);
      });

      it("403 FORBIDDEN si el pedido todavía no tiene una entrega asignada", async () => {
        const driver = await createDriver();
        const order = await createOrder(await createCustomer());

        const res = await uploadProof(driver.cookie, order.id);

        expectError(res, 403, "FORBIDDEN");
      });

      it("404 ORDER_NOT_FOUND si el pedido no existe (y no queda el archivo)", async () => {
        const admin = await createAdmin();

        const res = await uploadProof(admin.cookie, NON_EXISTENT_ID);

        expectError(res, 404, "ORDER_NOT_FOUND");
        expect(listUploadedFiles()).to.have.lengthOf(0);
      });

      describe("fallas al guardar", () => {
        const originalFindByIdAndUpdate = Order.findByIdAndUpdate;
        const originalMkdir = fsPromises.mkdir;
        afterEach(() => {
          Order.findByIdAndUpdate = originalFindByIdAndUpdate;
          fsPromises.mkdir = originalMkdir;
        });

        it("500 UPLOAD_ERROR si no se puede escribir en la carpeta de uploads (sin filtrar el detalle interno)", async () => {
          const { admin, order } = await setup();
          fsPromises.mkdir = async () => {
            throw new Error("EACCES: permission denied, mkdir");
          };

          const res = await uploadProof(admin.cookie, order.id);

          expectError(res, 500, "UPLOAD_ERROR");
          expect(res.body.message).to.not.include("EACCES");
        });

        it("500 DATABASE_ERROR si falla la base al registrar el comprobante (y se borra el archivo)", async () => {
          const { admin, order } = await setup();
          Order.findByIdAndUpdate = () => {
            throw Object.assign(new Error("connection lost"), { name: "MongoNetworkError" });
          };

          const res = await uploadProof(admin.cookie, order.id);

          expectError(res, 500, "DATABASE_ERROR");
          expect(listUploadedFiles()).to.have.lengthOf(0);
        });
      });
    });
  });
});
