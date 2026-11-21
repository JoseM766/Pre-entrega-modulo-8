import fs from "node:fs/promises";
import path from "node:path";
import { getFolderPath } from "../config/multer.config.js";
import { UploadError } from "../errors/index.js";

// Operaciones sobre los archivos ya subidos. No conoce Express ni Mongoose.

// Ruta relativa al proyecto y con "/", igual en Windows y Linux (es lo que se guarda en la base).
export const toStoredPath = (absolutePath) => path.relative(process.cwd(), absolutePath).split(path.sep).join("/");

// Arma los metadatos que se guardan en la base (nunca el contenido del archivo).
export const buildFileMetadata = (file, type) => ({
  originalName: path.basename(file.originalname),
  fileName: file.filename,
  path: toStoredPath(file.path),
  mimeType: file.mimetype,
  size: file.size,
  type,
  uploadedAt: new Date(),
});

// Mueve un archivo ya guardado a otra subcarpeta de uploads/ (ej. de documents a licenses).
export const moveToFolder = async (file, folder) => {
  const targetDir = getFolderPath(folder);
  if (path.dirname(file.path) === targetDir) return file;

  try {
    await fs.mkdir(targetDir, { recursive: true });
    const targetPath = path.join(targetDir, file.filename);
    await fs.rename(file.path, targetPath);
    return { ...file, path: targetPath, destination: targetDir };
  } catch (error) {
    throw new UploadError(undefined, error.message, error);
  }
};

// Borra un archivo sin fallar si no existe. Se usa para no dejar archivos huérfanos cuando
// la carga falla después de que Multer ya lo guardó (usuario inexistente, tipo inválido, error en la base...).
export const deleteFileQuietly = async (filePath) => {
  if (!filePath) return;
  try {
    await fs.rm(filePath, { force: true });
  } catch {
    // no hay nada más que hacer: el archivo ya no está o no se puede borrar
  }
};
