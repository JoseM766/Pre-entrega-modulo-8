import mongoose from "mongoose";
import { config } from "./index.js";
import { logger } from "./logger.js";

let closingOnPurpose = false;

// Solo abre y cierra la conexión. Las consultas las hacen los repositories.
export const connectDB = async () => {
  await mongoose.connect(config.mongoUri);
  logger.info("Conexión a MongoDB establecida");

  // Eventos posteriores a la conexión inicial (si el cierre es a propósito no es una "conexión perdida")
  mongoose.connection.on("disconnected", () => {
    if (!closingOnPurpose) logger.warning("Conexión a MongoDB perdida");
  });
  mongoose.connection.on("reconnected", () => logger.info("Conexión a MongoDB restablecida"));
  mongoose.connection.on("error", (error) => {
    logger.error(`Error en la conexión a MongoDB: ${error.message}`, { stack: error.stack });
  });
};

// Estado de la conexión, para el health check (no expone la URI ni credenciales).
export const getDatabaseStatus = () => (mongoose.connection.readyState === 1 ? "connected" : "disconnected");

export const disconnectDB = async () => {
  closingOnPurpose = true;
  await mongoose.disconnect();
  logger.info("Conexión a MongoDB cerrada");
};
