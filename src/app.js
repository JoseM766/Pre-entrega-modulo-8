import express from "express";
import cookieParser from "cookie-parser";
import passport from "passport";
import compression from "compression";
import swaggerUi from "swagger-ui-express";
import "./config/passport.config.js";
import productsRouter from "./routes/products.router.js";
import sessionsRouter from "./routes/sessions.router.js";
import ordersRouter from "./routes/orders.router.js";
import deliveriesRouter from "./routes/deliveries.router.js";
import usersRouter from "./routes/users.router.js";
import mocksRouter from "./routes/mocks.router.js";
import { config } from "./config/index.js";
import { swaggerSpecs } from "./docs/swagger.config.js";
import loggerRouter from "./routes/logger.router.js";
import healthRouter from "./routes/health.router.js";
import { requestLogger } from "./middlewares/logger.middleware.js";
import { errorHandler, notFoundHandler } from "./middlewares/error.middleware.js";

const app = express();

app.disable("x-powered-by"); // no anunciar qué tecnología usa el servidor
app.use(compression()); // respuestas comprimidas (gzip): menos bytes por la red
app.use(requestLogger);
app.use(express.json()); // límite de body: 100 kb por defecto
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(passport.initialize());

app.use("/api/health", healthRouter);

// Documentación interactiva (Swagger UI). Habilitada por defecto; se puede apagar con SWAGGER_ENABLED=false.
if (config.features.swagger) {
  app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpecs, { customSiteTitle: "ShipNow API Docs" }));
}

app.use("/api/products", productsRouter);
app.use("/api/sessions", sessionsRouter);
app.use("/api/users", usersRouter);
app.use("/api/orders", ordersRouter);
app.use("/api/deliveries", deliveriesRouter);

// Herramientas de desarrollo (mocks y loggerTest): NO se exponen en producción.
// Escriben datos de prueba en la base y generan logs de error, no tienen sentido en un servidor real.
if (config.features.devTools) {
  app.use("/api/mocks", mocksRouter);
  app.use("/api/loggerTest", loggerRouter);
}

app.use(notFoundHandler);

// SIEMPRE al final: Express lo reconoce como manejador de errores por tener 4 parámetros.
app.use(errorHandler);

export default app;