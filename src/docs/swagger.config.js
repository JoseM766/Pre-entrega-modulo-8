import path from "node:path";
import { fileURLToPath } from "node:url";
import swaggerJSDoc from "swagger-jsdoc";
import { config } from "../config/index.js";

// Configuración general de OpenAPI/Swagger. Vive acá, separada de las rutas.
// Los endpoints y schemas están en los archivos .yaml de esta misma carpeta.
const docsDir = path.dirname(fileURLToPath(import.meta.url));

const swaggerOptions = {
  definition: {
    openapi: "3.0.3",
    info: {
      title: "ShipNow API",
      version: "1.0.0",
      description:
        "API REST de **ShipNow**, una plataforma de gestión de envíos: usuarios, productos, pedidos y entregas.\n\n" +
        "**Propósito de esta documentación:** consultar y probar los endpoints desde el navegador.\n\n" +
        "**Cómo probar endpoints protegidos:** ejecutá primero `POST /api/sessions/login` desde esta página " +
        "(con `admin@shipnow.com` / `admin1234` después de correr `npm run seed`). La sesión viaja en una cookie " +
        "y el navegador la envía sola en los demás pedidos.\n\n" +
        "**Errores:** todos los errores de la API tienen la misma estructura (`ErrorResponse`).",
    },
    servers: [
      {
        url: config.apiBaseUrl,
        description: config.apiBaseUrl === `http://localhost:${config.port}` ? "Servidor local" : "Servidor de la API",
      },
    ],
    tags: [
      { name: "Sessions", description: "Registro, login y sesión (cookie con JWT)" },
      { name: "Users", description: "Consulta de usuarios (solo admin)" },
      { name: "Products", description: "Catálogo de productos" },
      { name: "Orders", description: "Pedidos de los clientes" },
      { name: "Deliveries", description: "Entregas: asignación de pedidos a repartidores y seguimiento" },
      { name: "Mocks", description: "Datos simulados y carga de datos de prueba (solo fuera de producción)" },
      { name: "Logger", description: "Herramienta interna para validar el logger (no es funcionalidad de negocio; solo fuera de producción)" },
      { name: "Health", description: "Health check: estado de la API, entorno, uptime y base de datos" },
    ],
  },
  apis: [path.join(docsDir, "*.yaml")],
};

export const swaggerSpecs = swaggerJSDoc(swaggerOptions);
