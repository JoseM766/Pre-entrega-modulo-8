import multer from "multer";
import { createUploader } from "../config/multer.config.js";
import { FILE_UPLOAD, UPLOAD_FOLDERS } from "../constants/index.js";
import {
  AppError,
  FileTooLargeError,
  InvalidFileFieldError,
  UploadError,
} from "../errors/index.js";

// Convierte los errores de Multer en errores del dominio, para que salgan con el formato
// general de la API (los responde errorHandler, no este archivo).
const translateUploadError = (error, fieldName) => {
  if (error instanceof AppError) return error; // ej. InvalidFileTypeError del fileFilter

  if (error instanceof multer.MulterError) {
    if (error.code === "LIMIT_FILE_SIZE") {
      const maxMb = FILE_UPLOAD.MAX_SIZE_BYTES / (1024 * 1024);
      return new FileTooLargeError(`El archivo supera el tamaño máximo permitido (${maxMb} MB)`, undefined, error);
    }

    // LIMIT_UNEXPECTED_FILE: el archivo llegó con otro nombre de campo (o hay más de uno)
    return new InvalidFileFieldError(
      `El archivo debe enviarse en un único campo llamado "${fieldName}"`,
      `Multer: ${error.code}${error.field ? ` (campo recibido: "${error.field}")` : ""}`,
      error
    );
  }

  // Cualquier otro fallo (disco lleno, sin permisos, etc.)
  return new UploadError(undefined, error?.message, error);
};

// Middleware de una sola subida: procesa el multipart/form-data y deja el archivo en req.file
// y los campos de texto en req.body. Si algo falla, deriva el error al middleware global.
const buildUploadMiddleware = (folder, fieldName) => {
  const uploader = createUploader(folder).single(fieldName);

  return (req, res, next) => {
    uploader(req, res, (error) => {
      if (error) return next(translateUploadError(error, fieldName));
      next();
    });
  };
};

// Documentos de usuario: campo "document". Se guardan primero en uploads/documents y, si el
// documento es una licencia, el service los mueve a uploads/licenses.
export const uploadUserDocument = buildUploadMiddleware(UPLOAD_FOLDERS.DOCUMENTS, FILE_UPLOAD.FIELDS.DOCUMENT);

// Comprobantes de entrega: campo "proof". Se guardan en uploads/proofs.
export const uploadProof = buildUploadMiddleware(UPLOAD_FOLDERS.PROOFS, FILE_UPLOAD.FIELDS.PROOF);
