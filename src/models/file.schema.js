import mongoose from "mongoose";
import { DOCUMENT_TYPES } from "../constants/index.js";

// Metadatos de un archivo subido. En la base se guarda SOLO esto: el archivo vive en la carpeta uploads/.
// Se reutiliza dentro de los documentos del usuario (documents) y de los comprobantes del pedido (proofs).
export const fileSchema = new mongoose.Schema(
  {
    originalName: { type: String, required: true }, // nombre con el que lo subió el cliente
    fileName: { type: String, required: true }, // nombre generado por el servidor
    path: { type: String, required: true }, // ruta relativa donde quedó guardado
    mimeType: { type: String, required: true },
    size: { type: Number, required: true, min: 0 }, // en bytes
    type: { type: String, enum: Object.values(DOCUMENT_TYPES), required: true }, // tipo de documento
    uploadedAt: { type: Date, required: true, default: Date.now },
  },
  { _id: false }
);
