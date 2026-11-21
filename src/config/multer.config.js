import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import multer from "multer";
import { config } from "./index.js";
import { FILE_UPLOAD, UPLOAD_FOLDERS } from "../constants/index.js";
import { InvalidFileTypeError } from "../errors/index.js";

// Configuración centralizada de Multer: dónde se guardan los archivos, cómo se nombran,
// qué tipos se aceptan y el tamaño máximo. Los routers NO configuran Multer: usan los
// middlewares de src/middlewares/upload.middleware.js, que se construyen con lo de este archivo.
//
// Estructura de carpetas (todo dentro de "uploads/", que está en .gitignore):
//   uploads/documents/  documentos de usuario
//   uploads/licenses/   licencias de repartidor
//   uploads/proofs/     comprobantes de entrega

export const UPLOAD_ROOT = path.join(process.cwd(), config.uploads.dir);

export const getFolderPath = (folder) => path.join(UPLOAD_ROOT, folder);

// Crea las carpetas si no existen (se llama al cargar el módulo y antes de cada guardado).
export const ensureUploadFolders = () => {
  Object.values(UPLOAD_FOLDERS).forEach((folder) => fs.mkdirSync(getFolderPath(folder), { recursive: true }));
};

// Nombre del archivo en el servidor: <fecha>-<uuid><extensión>. Es generado por el servidor y la
// extensión sale del tipo MIME validado, nunca del nombre que mandó el cliente (evita nombres
// peligrosos como "../../x.pdf" y colisiones entre archivos con el mismo nombre).
const buildFileName = (file) => {
  const [extension] = FILE_UPLOAD.ALLOWED_TYPES[file.mimetype];
  return `${Date.now()}-${crypto.randomUUID()}${extension}`;
};

const buildStorage = (folder) =>
  multer.diskStorage({
    destination: (req, file, callback) => {
      try {
        ensureUploadFolders();
        callback(null, getFolderPath(folder));
      } catch (error) {
        callback(error);
      }
    },
    filename: (req, file, callback) => callback(null, buildFileName(file)),
  });

// Solo se aceptan los tipos de FILE_UPLOAD.ALLOWED_TYPES: el MIME type y la extensión deben coincidir.
const fileFilter = (req, file, callback) => {
  const allowedExtensions = FILE_UPLOAD.ALLOWED_TYPES[file.mimetype];
  const extension = path.extname(file.originalname).toLowerCase();

  if (allowedExtensions?.includes(extension)) {
    return callback(null, true);
  }

  const allowed = Object.keys(FILE_UPLOAD.ALLOWED_TYPES).join(", ");
  callback(
    new InvalidFileTypeError(
      `El tipo de archivo no está permitido. Se aceptan: ${allowed}`,
      `Recibido: ${file.mimetype} (${path.basename(file.originalname)})`
    )
  );
};

// Crea un "uploader" de Multer que guarda en la subcarpeta indicada.
export const createUploader = (folder) =>
  multer({
    storage: buildStorage(folder),
    fileFilter,
    defParamCharset: "utf8", // nombres con acentos o ñ (por defecto Multer los decodifica como latin1 y los rompe)
    limits: {
      fileSize: FILE_UPLOAD.MAX_SIZE_BYTES, // tamaño máximo por archivo
      files: 1, // un solo archivo por petición
      fields: 10, // campos de texto del form-data
    },
  });

ensureUploadFolders();
