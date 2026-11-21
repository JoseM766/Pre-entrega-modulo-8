import dotenv from "dotenv";
import { NODE_ENVIRONMENTS, LOG_LEVELS } from "../constants/index.js";

// Este es el ÚNICO archivo del proyecto que lee process.env.
// El resto de la app importa el objeto "config" de acá.
//
// Entorno de testing separado: con NODE_ENV=test se lee ".env.test" (con su propia base de datos)
// en lugar de ".env", así los tests nunca tocan los datos de desarrollo.
const envFile = process.env.NODE_ENV === NODE_ENVIRONMENTS.TEST ? ".env.test" : ".env";
dotenv.config({ path: envFile });

// Sin estas variables la app no puede funcionar: si falta alguna, no arranca.
const REQUIRED_ENV_VARS = ["PORT", "MONGODB_URI", "NODE_ENV", "JWT_SECRET"];

const missingVars = REQUIRED_ENV_VARS.filter((name) => {
  const value = process.env[name];
  return value === undefined || value.trim() === "";
});

if (missingVars.length > 0) {
  throw new Error(
    `Faltan variables de entorno obligatorias: ${missingVars.join(", ")}. ` +
      `Revisá tu archivo ${envFile} (podés copiar ${envFile}.example).`
  );
}

const port = Number(process.env.PORT);

if (!Number.isInteger(port) || port <= 0) {
  throw new Error(`La variable PORT debe ser un número entero positivo. Valor recibido: "${process.env.PORT}"`);
}

const validEnvironments = Object.values(NODE_ENVIRONMENTS);

if (!validEnvironments.includes(process.env.NODE_ENV)) {
  throw new Error(
    `La variable NODE_ENV tiene un valor inválido: "${process.env.NODE_ENV}". ` +
      `Valores permitidos: ${validEnvironments.join(", ")}`
  );
}

export const config = Object.freeze({
  port,
  nodeEnv: process.env.NODE_ENV,
  isProduction: process.env.NODE_ENV === NODE_ENVIRONMENTS.PRODUCTION,
  isTest: process.env.NODE_ENV === NODE_ENVIRONMENTS.TEST,
  mongoUri: process.env.MONGODB_URI,
  // Logging según el entorno: producción registra desde info; desarrollo (y test) desde debug.
  logs: Object.freeze({
    level: process.env.NODE_ENV === NODE_ENVIRONMENTS.PRODUCTION ? LOG_LEVELS.INFO : LOG_LEVELS.DEBUG,
    dir: "logs",
  }),
  // Carpeta donde se guardan los archivos subidos (en test se usa una subcarpeta aparte, que se limpia sola).
  uploads: Object.freeze({
    dir: process.env.NODE_ENV === NODE_ENVIRONMENTS.TEST ? "uploads/test" : "uploads",
  }),
  jwt: Object.freeze({
    secret: process.env.JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRES_IN || "1h",
  }),
});
