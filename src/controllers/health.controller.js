import * as healthService from "../services/health.service.js";

// 200 si todo está bien; 503 si la API no puede atender (por ejemplo, sin conexión a la base).
// Así un balanceador o Docker (HEALTHCHECK) detectan el problema por el status HTTP.
export const getHealth = (req, res) => {
  const health = healthService.getHealth();
  res.status(health.status === "ok" ? 200 : 503).json(health);
};
