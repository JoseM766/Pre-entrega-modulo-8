import { config } from "../config/index.js";
import { logger } from "../config/logger.js";
import {
  AppError,
  InvalidJsonError,
  PayloadTooLargeError,
  ValidationError,
  DuplicateKeyError,
  DatabaseError,
  InternalServerError,
  RouteNotFoundError,
} from "../errors/index.js";

// Los controllers, middlewares y services NUNCA responden errores: los lanzan o llaman next(error).
// La respuesta de error de toda la API sale únicamente de acá.

// Cualquier cosa que llegue (error propio, error de Express, de Mongoose o inesperado)
// se convierte en un AppError conocido.
const normalizeError = (error) => {
  if (error instanceof AppError) return error;

  // JSON mal formado en el body (lo detecta express.json)
  if (error?.type === "entity.parse.failed") {
    return new InvalidJsonError(undefined, error.message);
  }

  // Body más grande que el límite de express.json (100 kb por defecto): 413, no un 500
  if (error?.type === "entity.too.large") {
    return new PayloadTooLargeError(undefined, error.message);
  }

  // Errores de Mongoose / MongoDB que se escaparon de un repository
  if (error?.code === 11000) {
    return new DuplicateKeyError(undefined, JSON.stringify(error.keyValue ?? {}));
  }
  if (error?.name === "ValidationError" || error?.name === "CastError") {
    return new ValidationError(undefined, error.message);
  }
  if (/^Mongo/.test(error?.name ?? "")) {
    return new DatabaseError(undefined, error.message, error);
  }

  return new InternalServerError(undefined, error?.message, error);
};

// Ruta inexistente: se registra después de todas las rutas y antes de errorHandler.
export const notFoundHandler = (req, res, next) => {
  next(new RouteNotFoundError(undefined, `${req.method} ${req.originalUrl}`));
};

// Middleware de errores de Express (4 parámetros). Debe registrarse al final de app.js.
export const errorHandler = (error, req, res, next) => {
  if (res.headersSent) return next(error);

  const appError = normalizeError(error);

  // Logging: los errores esperados (4xx, del cliente o de negocio) son warning;
  // los inesperados (5xx) son error y se registran con su stack. Nunca se le muestran al cliente.
  const origin = `[${req.method} ${req.originalUrl}]`;
  if (appError.statusCode >= 500) {
    logger.error(`${appError.code}: ${appError.message} ${origin}`, {
      stack: (appError.cause ?? error)?.stack,
    });
  } else {
    logger.warning(`${appError.code}: ${appError.message} ${origin}`);
  }

  const body = {
    status: "error",
    error: appError.code,
    message: appError.message,
  };

  // details (debugging) solo fuera de producción
  if (appError.details && !config.isProduction) {
    body.details = appError.details;
  }

  res.status(appError.statusCode).json(body);
};
