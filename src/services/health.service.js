import { config } from "../config/index.js";
import { getDatabaseStatus } from "../config/db.config.js";

// Estado de la API para el health check. No expone información sensible:
// nada de URI de base de datos, secretos, rutas internas ni versiones.
export const getHealth = () => {
  const database = getDatabaseStatus();

  return {
    status: database === "connected" ? "ok" : "degraded",
    environment: config.nodeEnv,
    uptime: Math.round(process.uptime()), // segundos desde que arrancó el proceso
    timestamp: new Date().toISOString(),
    database,
  };
};
