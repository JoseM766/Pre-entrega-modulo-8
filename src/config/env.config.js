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

const isProduction = process.env.NODE_ENV === NODE_ENVIRONMENTS.PRODUCTION;
const isTest = process.env.NODE_ENV === NODE_ENVIRONMENTS.TEST;

// La URI debe ser de MongoDB (falla al inicio con un mensaje claro, en lugar de un error confuso al conectar).
if (!/^mongodb(\+srv)?:\/\//.test(process.env.MONGODB_URI)) {
  throw new Error('La variable MONGODB_URI debe empezar con "mongodb://" o "mongodb+srv://".');
}

// En producción un secreto corto o de ejemplo es un riesgo de seguridad: no se permite.
const MIN_PRODUCTION_SECRET_LENGTH = 16;
if (isProduction && process.env.JWT_SECRET.length < MIN_PRODUCTION_SECRET_LENGTH) {
  throw new Error(
    `En producción JWT_SECRET debe tener al menos ${MIN_PRODUCTION_SECRET_LENGTH} caracteres (usá un valor largo y aleatorio).`
  );
}

// Nivel de logs: por defecto depende del entorno, y se puede ajustar con LOG_LEVEL.
const defaultLogLevel = isProduction ? LOG_LEVELS.INFO : LOG_LEVELS.DEBUG;
const logLevel = process.env.LOG_LEVEL?.trim() || defaultLogLevel;
if (!Object.values(LOG_LEVELS).includes(logLevel)) {
  throw new Error(
    `La variable LOG_LEVEL tiene un valor inválido: "${logLevel}". Valores permitidos: ${Object.values(LOG_LEVELS).join(", ")}`
  );
}

// Swagger: habilitado por defecto en todos los entornos; en producción se puede apagar con SWAGGER_ENABLED=false.
const swaggerFlag = process.env.SWAGGER_ENABLED?.trim().toLowerCase();
if (swaggerFlag !== undefined && swaggerFlag !== "" && !["true", "false"].includes(swaggerFlag)) {
  throw new Error(`La variable SWAGGER_ENABLED debe ser "true" o "false". Valor recibido: "${process.env.SWAGGER_ENABLED}"`);
}
const swaggerEnabled = swaggerFlag ? swaggerFlag === "true" : true;

// URL pública de la API (se muestra en Swagger). Opcional: por defecto es el servidor local.
const apiBaseUrl = process.env.API_BASE_URL?.trim() || `http://localhost:${port}`;
try {
  new URL(apiBaseUrl);
} catch {
  throw new Error(`La variable API_BASE_URL no es una URL válida. Valor recibido: "${process.env.API_BASE_URL}"`);
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
  isProduction,
  isTest,
  mongoUri: process.env.MONGODB_URI,
  apiBaseUrl,
  // Qué endpoints "internos" están disponibles:
  //  - devTools (mocks y loggerTest): solo fuera de producción (escriben datos / generan logs de error).
  //  - swagger: habilitado salvo que se lo apague con SWAGGER_ENABLED=false.
  features: Object.freeze({
    devTools: !isProduction,
    swagger: swaggerEnabled,
  }),
  // Logging según el entorno: producción registra desde info; desarrollo (y test) desde debug.
  logs: Object.freeze({
    level: logLevel,
    dir: "logs",
  }),
  // Carpeta donde se guardan los archivos subidos (en test se usa una subcarpeta aparte, que se limpia sola).
  uploads: Object.freeze({
    dir: isTest ? "uploads/test" : "uploads",
  }),
  jwt: Object.freeze({
    secret: process.env.JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRES_IN || "1h",
  }),
});
