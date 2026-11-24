# ShipNow — Pre-entrega Módulo 8: Performance, escalabilidad y Docker

ShipNow API preparada para ejecutarse de forma estable y lista para despliegue: buenas prácticas de performance, configuración por entorno validada, health check y contenedor Docker.

## Variables de entorno

Hay un archivo modelo por entorno (los reales `.env`, `.env.test` y `.env.production` **no se suben al repo**):

| Entorno | Modelo | Archivo real |
|---|---|---|
| Desarrollo | `.env.example` | `.env` |
| Testing | `.env.test.example` | `.env.test` |
| Producción / Docker | `.env.production.example` | `.env.production` |

| Variable | Obligatoria | Descripción |
|---|---|---|
| `NODE_ENV` | Sí | `development`, `production` o `test` |
| `PORT` | Sí | Puerto de la API |
| `MONGODB_URI` | Sí | URI de MongoDB (debe empezar con `mongodb://` o `mongodb+srv://`) |
| `JWT_SECRET` | Sí | Secreto del JWT. **En producción, mínimo 16 caracteres** |
| `JWT_EXPIRES_IN` | No | Expiración del JWT (por defecto `1h`) |
| `LOG_LEVEL` | No | `debug`, `http`, `info`, `warning`, `error` o `fatal`. Por defecto: `debug` en desarrollo/test, `info` en producción |
| `SWAGGER_ENABLED` | No | `true` (por defecto) o `false` para apagar Swagger |
| `API_BASE_URL` | No | URL pública de la API, que se muestra en Swagger (por defecto `http://localhost:PORT`) |

La API no consume servicios externos aparte de MongoDB, por eso no hay otras URLs. No hay valores sensibles en el código.

**Validación al iniciar:** si falta una variable obligatoria o alguna tiene un valor inválido (puerto no numérico, `NODE_ENV` desconocido, URI que no es de MongoDB, `LOG_LEVEL` inválido, secreto corto en producción...), la app **no arranca** y muestra un mensaje claro, por ejemplo:

```
[fatal] Faltan variables de entorno obligatorias: MONGODB_URI. Revisá tu archivo .env (podés copiar .env.example).
```

## Cómo correr la API localmente

```bash
npm install
cp .env.example .env     # completar MONGODB_URI y JWT_SECRET
npm run seed             # opcional: usuarios y productos de prueba
npm run dev              # desarrollo, con reinicio automático
npm start                # modo normal
```

## Cómo correr los tests

```bash
cp .env.test.example .env.test    # con una base de datos de TEST (el nombre debe contener "test")
npm test
```

## Cómo acceder a Swagger

`http://localhost:8080/api/docs` (o el puerto configurado). Swagger está disponible en todos los entornos, incluida producción, salvo que se defina `SWAGGER_ENABLED=false`.

## Health check

`GET /api/health` devuelve el estado de la API, el entorno, el uptime y el estado de la base de datos:

```json
{
  "status": "ok",
  "environment": "production",
  "uptime": 3600,
  "timestamp": "2026-11-21T20:00:00.000Z",
  "database": "connected"
}
```

- Responde `200` si todo está bien y `503` (`"status": "degraded"`) si no hay conexión con la base de datos, para que Docker o un balanceador lo detecten por el código HTTP.
- **No expone información sensible:** ni la URI de la base, ni secretos, ni rutas internas, ni versiones.

## Performance

- **Listados paginados y filtrables:** usuarios, pedidos, entregas y productos usan `page` y `limit` (máximo **50** por página) y filtros (`role`, `status`, `category`). Valores inválidos vuelven al valor por defecto. Ningún endpoint devuelve una colección completa.
- **Orden controlado:** el listado de productos solo permite ordenar por `name`, `price`, `stock`, `category` y `createdAt` (otro campo responde `400 INVALID_SORT`).
- **Índices** en las colecciones que respaldan los filtros y el orden por fecha de los listados (pedidos, entregas, productos y usuarios). Las consultas usan `.lean()` y proyecciones.
- **Carga de archivos con límites:** 5 MB por archivo, un solo archivo por petición, tipos restringidos (PDF, JPG, PNG) y errores controlados. Los archivos van a `uploads/`, que está fuera del repo.
- **Payloads:** los bodies JSON tienen un máximo de 100 kb (más grande responde `413 PAYLOAD_TOO_LARGE`), las respuestas se comprimen con gzip, los mocks tienen un máximo de 100 por pedido y la cabecera `X-Powered-By` está desactivada.
- **Event Loop:** no hay operaciones sincrónicas de archivos durante las peticiones (la carpeta de uploads se crea con `fs.promises`); las contraseñas se hashean con bcrypt asíncrono.
- **Logs sin exceso:** en producción el nivel por defecto es `info` (no se registran `debug` ni `http`).
- **Apagado ordenado:** al recibir `SIGTERM`/`SIGINT` el servidor termina las peticiones en curso y cierra la conexión a la base antes de salir.

## Criterio aplicado a los endpoints internos en producción

| Endpoint | En producción | Por qué |
|---|---|---|
| `/api/mocks/*` | **No disponible** (`404 ROUTE_NOT_FOUND`) | Inserta datos de prueba en la base: no tiene sentido en un servidor real |
| `/api/loggerTest` | **No disponible** (`404 ROUTE_NOT_FOUND`) | Genera logs de error y fatal a propósito y no requiere autenticación |
| `/api/docs` (Swagger) | **Disponible** por defecto; se apaga con `SWAGGER_ENABLED=false` | La documentación no contiene secretos y es necesaria para probar el contenedor; quien no quiera exponerla la desactiva |
| `/api/health` | **Disponible** | Lo usan el `HEALTHCHECK` de Docker y los balanceadores; no expone datos sensibles |

Mocks y loggerTest dependen de `NODE_ENV`, no de una variable que se pueda activar por error.

## Docker

**Puerto:** la API usa el **8080** por defecto (variable `PORT`). La imagen tiene `EXPOSE 8080`.

**Construir la imagen** (hacé antes `npm install` para que `package-lock.json` esté actualizado):

```bash
docker build -t shipnow-api .
```

**Ejecutar el contenedor**, pasando las variables de entorno desde un archivo externo:

```bash
cp .env.production.example .env.production     # y completar MONGODB_URI y JWT_SECRET
docker run -d --name shipnow-api \
  --env-file .env.production \
  -p 8080:8080 \
  -v shipnow_uploads:/app/uploads \
  -v shipnow_logs:/app/logs \
  shipnow-api
```

**Probar** que funciona:

```bash
curl http://localhost:8080/api/health          # health check
# Swagger:  http://localhost:8080/api/docs
curl "http://localhost:8080/api/products"      # endpoint principal
docker logs shipnow-api                         # logs
docker stop shipnow-api                         # apagado ordenado
```

Si en `.env.production` ponés `PORT=3000`, mapeá ese puerto: `-p 3000:3000`.

**Aclaración sobre `MONGODB_URI`:** dentro del contenedor, `localhost` es el propio contenedor y no tu máquina. Usá una base en la nube (Atlas), `host.docker.internal` para un Mongo instalado en tu máquina, o la opción de abajo.

**Opcional, con Mongo incluido** (para probar sin Atlas):

```bash
cp .env.production.example .env.production     # completar JWT_SECRET
docker compose up --build
```

`docker-compose.yml` levanta la API más una base MongoDB local y usa volúmenes para la base, los archivos subidos y los logs.

**Qué hace el Dockerfile:** parte de `node:22-slim`; instala solo las dependencias de producción (`npm ci --omit=dev`); copia únicamente `package.json`, `package-lock.json` y `src/`; crea las carpetas `logs` y `uploads`; corre como usuario sin privilegios (`node`); define un `HEALTHCHECK` que consulta `/api/health`; e inicia con `node src/server.js` (el mismo comando que `npm start`, ejecutado directo para que Node reciba la señal de apagado de Docker).

**`.dockerignore`:** deja fuera `node_modules`, `.env` y `.env.*`, `.git`, `logs`, `uploads`, `tests`, `coverage`, archivos temporales y de documentación, para que nada sensible ni innecesario entre a la imagen.

## Archivos que no deben subirse al repositorio

`node_modules/`, `.env`, `.env.test`, `.env.production` (contienen credenciales), `logs/` y `uploads/` (los genera la aplicación). Todos están en `.gitignore`.

## Logs y uploads en contenedores

- **Logs:** van a la consola (se ven con `docker logs`) y los errores (`error` y `fatal`) también a `logs/`, con rotación diaria (14 días, 10 MB por archivo). Con el volumen `shipnow_logs` sobreviven a un reinicio del contenedor.
- **Uploads:** el sistema de archivos de un contenedor es descartable, por eso `uploads/` se monta como volumen. Es una solución para una sola instancia: si la API se escala a varias réplicas, los archivos deberían ir a un almacenamiento compartido (por ejemplo un bucket S3), no al disco local.

## Dependencias

Se actualizaron las dependencias con `npm audit fix` y `bcrypt` a la versión 6 (que ya incluye sus binarios). Quedan 3 avisos de severidad moderada en dependencias internas de `swagger-jsdoc` (`glob` y `minimatch`), que solo leen los archivos `.yaml` propios al arrancar y no reciben datos de usuarios.

## Archivos de esta entrega

```
Dockerfile · .dockerignore · docker-compose.yml
.env.example · .env.production.example
src/
├── config/env.config.js         # variables por entorno y validación al iniciar
├── services/health.service.js · controllers/health.controller.js · routes/health.router.js
├── utils/pagination.js          # paginación común
├── models/                      # índices
├── app.js · server.js           # endpoints internos según entorno, compresión, apagado ordenado
└── docs/                        # Swagger actualizado
tests/
├── production.test.js           # comportamiento en producción y validación de variables
└── performance.test.js          # paginación, índices, compresión, límites
```
