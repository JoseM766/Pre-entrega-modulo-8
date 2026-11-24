// Los imports son dinámicos a propósito: el logger depende de la configuración, así que si la
// configuración es inválida (falta una variable) todavía no existe un logger. Ese es el único
// caso del proyecto que sale por console.error; todo lo demás usa el logger.
const loadConfig = async () => {
  try {
    const { config } = await import("./config/index.js");
    return config;
  } catch (error) {
    console.error(`[fatal] ${error.message}`);
    process.exit(1);
  }
};

const startServer = async () => {
  const config = await loadConfig();
  const { logger, closeLogger } = await import("./config/logger.js");
  const { connectDB, disconnectDB } = await import("./config/db.config.js");
  const { default: app } = await import("./app.js");

  // Registra el error fatal, espera a que el logger termine de escribir y recién ahí corta el proceso.
  const exitWithFatal = async (message, error) => {
    logger.fatal(message, { stack: error?.stack });
    await closeLogger();
    process.exit(1);
  };

  process.on("uncaughtException", (error) => exitWithFatal(`Excepción no capturada: ${error.message}`, error));
  process.on("unhandledRejection", (reason) => {
    exitWithFatal(`Promesa rechazada sin manejar: ${reason?.message ?? reason}`, reason);
  });

  try {
    await connectDB();
  } catch (error) {
    // Sin base de datos no tiene sentido dejar el servidor levantado.
    return exitWithFatal(`No se pudo conectar a MongoDB: ${error.message}`, error);
  }

  const server = app.listen(config.port, () => {
    logger.info(`Servidor ShipNow escuchando en el puerto ${config.port} (${config.nodeEnv})`);
  });

  // Apagado ordenado (Docker envía SIGTERM al detener el contenedor; Ctrl+C envía SIGINT):
  // se deja de aceptar conexiones, se terminan las peticiones en curso y se cierra la base.
  const shutdown = (signal) => {
    logger.info(`Señal ${signal} recibida: cerrando el servidor...`);

    const forceExit = setTimeout(() => process.exit(1), 10000); // si algo se traba, se corta igual
    forceExit.unref();

    server.close(async () => {
      await disconnectDB();
      logger.info("Servidor detenido correctamente");
      await closeLogger();
      process.exit(0);
    });
  };
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
};

startServer();
