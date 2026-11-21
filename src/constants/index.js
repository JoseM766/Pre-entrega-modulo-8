// Valores inmutables del dominio. Object.freeze evita que se modifiquen en runtime
// y centraliza los "strings mágicos" en un único lugar.

export const USER_ROLES = Object.freeze({
  ADMIN: "admin",
  USER: "user", // cliente
  DRIVER: "driver", // repartidor
});

export const PRODUCT_STATUS = Object.freeze({
  AVAILABLE: "available",
  OUT_OF_STOCK: "out_of_stock",
});

export const NODE_ENVIRONMENTS = Object.freeze({
  DEVELOPMENT: "development",
  PRODUCTION: "production",
  TEST: "test",
});

export const ORDER_STATUS = Object.freeze({
  CREATED: "created",
  ASSIGNED: "assigned",
  PICKED_UP: "picked_up",
  IN_TRANSIT: "in_transit",
  DELIVERED: "delivered",
  CANCELLED: "cancelled",
});

export const DELIVERY_STATUS = Object.freeze({
  ASSIGNED: "assigned",
  PICKED_UP: "picked_up",
  IN_TRANSIT: "in_transit",
  DELIVERED: "delivered",
});

export const DELIVERY_PRIORITY = Object.freeze({
  LOW: "low",
  NORMAL: "normal",
  HIGH: "high",
  URGENT: "urgent",
});

// Estado de la entrega que corresponde a cada estado del pedido.
// Un pedido CREATED o CANCELLED no tiene entrega.
export const ORDER_TO_DELIVERY_STATUS = Object.freeze({
  [ORDER_STATUS.ASSIGNED]: DELIVERY_STATUS.ASSIGNED,
  [ORDER_STATUS.PICKED_UP]: DELIVERY_STATUS.PICKED_UP,
  [ORDER_STATUS.IN_TRANSIT]: DELIVERY_STATUS.IN_TRANSIT,
  [ORDER_STATUS.DELIVERED]: DELIVERY_STATUS.DELIVERED,
});

export const MOCK_LIMITS = Object.freeze({
  DEFAULT_QTY: 10,
  MAX_QTY: 100,
});

export const MOCK_PASSWORD = "coder123";

export const LOG_LEVELS = Object.freeze({
  DEBUG: "debug",
  HTTP: "http",
  INFO: "info",
  WARNING: "warning",
  ERROR: "error",
  FATAL: "fatal",
});

// En Winston un número MENOR es más severo: con level "info" se registra info y todo lo más grave
// (warning, error, fatal), y se descartan http y debug.
export const LOG_LEVEL_PRIORITY = Object.freeze({
  [LOG_LEVELS.FATAL]: 0,
  [LOG_LEVELS.ERROR]: 1,
  [LOG_LEVELS.WARNING]: 2,
  [LOG_LEVELS.INFO]: 3,
  [LOG_LEVELS.HTTP]: 4,
  [LOG_LEVELS.DEBUG]: 5,
});

export const LOG_COLORS = Object.freeze({
  [LOG_LEVELS.FATAL]: "bold red",
  [LOG_LEVELS.ERROR]: "red",
  [LOG_LEVELS.WARNING]: "yellow",
  [LOG_LEVELS.INFO]: "green",
  [LOG_LEVELS.HTTP]: "magenta",
  [LOG_LEVELS.DEBUG]: "blue",
});

// Una entrega solo avanza hacia adelante, un paso por vez.
export const DELIVERY_STATUS_TRANSITIONS = Object.freeze({
  [DELIVERY_STATUS.ASSIGNED]: [DELIVERY_STATUS.PICKED_UP],
  [DELIVERY_STATUS.PICKED_UP]: [DELIVERY_STATUS.IN_TRANSIT],
  [DELIVERY_STATUS.IN_TRANSIT]: [DELIVERY_STATUS.DELIVERED],
  [DELIVERY_STATUS.DELIVERED]: [],
});

// Al cambiar el estado de la entrega, el pedido pasa a su estado equivalente.
export const DELIVERY_TO_ORDER_STATUS = Object.freeze({
  [DELIVERY_STATUS.ASSIGNED]: ORDER_STATUS.ASSIGNED,
  [DELIVERY_STATUS.PICKED_UP]: ORDER_STATUS.PICKED_UP,
  [DELIVERY_STATUS.IN_TRANSIT]: ORDER_STATUS.IN_TRANSIT,
  [DELIVERY_STATUS.DELIVERED]: ORDER_STATUS.DELIVERED,
});

export const PAGINATION = Object.freeze({
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 10,
  MAX_LIMIT: 50,
});

// --- Carga de archivos (Módulo 7) ---

export const DOCUMENT_TYPES = Object.freeze({
  USER_DOCUMENT: "user_document",
  DRIVER_LICENSE: "driver_license",
  DELIVERY_PROOF: "delivery_proof",
});

// Tipos que se pueden indicar al subir un documento de usuario (el comprobante tiene su propio endpoint).
export const USER_DOCUMENT_TYPES = Object.freeze([DOCUMENT_TYPES.USER_DOCUMENT, DOCUMENT_TYPES.DRIVER_LICENSE]);

// Subcarpetas dentro de la carpeta de uploads.
export const UPLOAD_FOLDERS = Object.freeze({
  DOCUMENTS: "documents",
  LICENSES: "licenses",
  PROOFS: "proofs",
});

// En qué subcarpeta se guarda cada tipo de documento.
export const DOCUMENT_TYPE_FOLDERS = Object.freeze({
  [DOCUMENT_TYPES.USER_DOCUMENT]: UPLOAD_FOLDERS.DOCUMENTS,
  [DOCUMENT_TYPES.DRIVER_LICENSE]: UPLOAD_FOLDERS.LICENSES,
  [DOCUMENT_TYPES.DELIVERY_PROOF]: UPLOAD_FOLDERS.PROOFS,
});

export const FILE_UPLOAD = Object.freeze({
  MAX_SIZE_BYTES: 5 * 1024 * 1024, // 5 MB
  // Nombre del campo del form-data que contiene el archivo, según el endpoint
  FIELDS: Object.freeze({ DOCUMENT: "document", PROOF: "proof" }),
  // Tipos aceptados: MIME type -> extensiones permitidas (la primera se usa al nombrar el archivo)
  ALLOWED_TYPES: Object.freeze({
    "application/pdf": Object.freeze([".pdf"]),
    "image/jpeg": Object.freeze([".jpg", ".jpeg"]),
    "image/png": Object.freeze([".png"]),
  }),
});
