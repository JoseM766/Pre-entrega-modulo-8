import fs from "node:fs";
import path from "node:path";
import { UPLOAD_ROOT } from "../../src/config/multer.config.js";
import { FILE_UPLOAD } from "../../src/constants/index.js";

// Archivos de prueba chicos y generados en memoria (no hay archivos reales en el repo).
export const pdfBuffer = (size = 1024) => Buffer.concat([Buffer.from("%PDF-1.4\n"), Buffer.alloc(size, "a")]);
export const pngBuffer = () => Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(64)]);
export const jpegBuffer = () => Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(64)]);

// Archivo de exactamente el tamaño máximo permitido y uno que lo supera por 1 byte.
export const maxSizePdf = () => pdfBuffer(FILE_UPLOAD.MAX_SIZE_BYTES - 9);
export const oversizedPdf = () => pdfBuffer(FILE_UPLOAD.MAX_SIZE_BYTES - 9 + 1);

export const PDF = { filename: "dni.pdf", contentType: "application/pdf" };
export const PNG = { filename: "comprobante.png", contentType: "image/png" };
export const JPG = { filename: "foto.jpg", contentType: "image/jpeg" };

// Lista de todos los archivos que hay en la carpeta de uploads del entorno de test.
export const listUploadedFiles = (dir = UPLOAD_ROOT) => {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? listUploadedFiles(full) : [full];
  });
};

// Ruta absoluta a partir de la ruta relativa que devuelve la API (ej. "uploads/test/documents/x.pdf").
export const absolutePath = (relativePath) => path.join(process.cwd(), relativePath);
export const fileExists = (relativePath) => fs.existsSync(absolutePath(relativePath));
