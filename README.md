# ShipNow — Pre-entrega Módulo 7: Carga de archivos, documentos y comprobantes

Carga de archivos con **Multer** (`multipart/form-data`): se validan, se guardan en carpetas del servidor y se registran **solo sus metadatos** en MongoDB, asociados a un usuario o a un pedido. Está integrado con la arquitectura por capas, el manejo de errores, el logger, Swagger y los tests.

## Cómo correr el proyecto

```bash
npm install
cp .env.example .env     # completar MONGODB_URI y JWT_SECRET
npm run seed             # usuarios de prueba (admin, user, driver)
npm run dev
```

La documentación interactiva está en `http://localhost:8080/api/docs`.

## Endpoints

| Método | Ruta | Campo del archivo | Quién | Descripción |
|---|---|---|---|---|
| POST | `/api/users/:id/documents` | `document` | El propio usuario o un admin | Sube un documento del usuario |
| GET | `/api/users/:id/documents` | — | El propio usuario o un admin | Lista los metadatos de sus documentos |
| POST | `/api/orders/:id/proof` | `proof` | El repartidor asignado al pedido o un admin | Sube el comprobante de entrega de un pedido |

**Campos adicionales (`POST /api/users/:id/documents`):** `type` (opcional). Valores permitidos: `user_document` (por defecto) y `driver_license`. Se envía como campo de texto del form-data.

**Respuestas exitosas (`201`):**
- Documento de usuario: devuelve `{ status, message, payload: { id, documents: [...] } }` con todos los documentos del usuario.
- Comprobante: devuelve el **pedido actualizado**, con su lista `proofs`.

## Cómo probarlo

**Con Swagger** (`/api/docs`): hacé login con `POST /api/sessions/login` (por ejemplo `driver@shipnow.com` / `driver1234`), abrí el endpoint, tocá **Try it out**, elegí el archivo en el campo `document` (o `proof`) y **Execute**.

**Con Postman:** método `POST`, pestaña Body → `form-data`; agregá una clave `document` de tipo **File** y, si querés, una clave `type` de tipo Text.

**Con curl:**

```bash
# login (guarda la cookie)
curl -c cookies.txt -H "Content-Type: application/json" \
  -d '{"email":"driver@shipnow.com","password":"driver1234"}' http://localhost:8080/api/sessions/login

# subir una licencia (reemplazá USER_ID)
curl -b cookies.txt -F "document=@licencia.pdf;type=application/pdf" -F "type=driver_license" \
  http://localhost:8080/api/users/USER_ID/documents
```

## Configuración de Multer (centralizada, separada de los routers)

| Archivo | Qué hace |
|---|---|
| `src/config/multer.config.js` | Define **dónde se guardan** los archivos (`diskStorage`), **cómo se nombran**, **qué tipos se aceptan** (`fileFilter`) y el **tamaño máximo** (`limits`) |
| `src/middlewares/upload.middleware.js` | Crea los middlewares `uploadUserDocument` y `uploadProof` y **traduce los errores de Multer** al sistema de errores del proyecto |
| `src/utils/file-storage.js` | Mover y borrar archivos y armar los metadatos |

Los routers solo importan el middleware; no configuran Multer.

- **Nombres:** `<fecha>-<uuid><extensión>`, generados por el servidor. La extensión sale del tipo MIME validado, nunca del nombre que manda el cliente, así que un nombre como `../../x.pdf` no puede afectar dónde se guarda, y dos archivos con el mismo nombre no se pisan.
- **Tipos aceptados:** PDF (`application/pdf`), JPG (`image/jpeg`) y PNG (`image/png`). El MIME type **y** la extensión deben coincidir.
- **Tamaño máximo:** 5 MB. **Un solo archivo** por petición.
- Las constantes (tipos, tamaño, campos, carpetas) están en `src/constants/index.js`.

## Estructura de carpetas

```
uploads/
├── documents/   documentos de usuario        (type = user_document)
├── licenses/    licencias de repartidor      (type = driver_license)
└── proofs/      comprobantes de entrega      (type = delivery_proof)
```

La carpeta `uploads/` está en `.gitignore`: **los archivos subidos no van al repositorio**. Las subcarpetas se crean solas al arrancar. Los archivos **no se sirven públicamente**: solo se guarda la referencia.

## Qué se guarda en la base (solo metadatos)

El archivo vive en el servidor. En MongoDB (en `documents` del usuario o `proofs` del pedido) se guarda:

```json
{
  "originalName": "licencia.pdf",
  "fileName": "1795296339996-d9cd6685-a257-4e70-bb46-320861ef45e2.pdf",
  "path": "uploads/licenses/1795296339996-d9cd6685-a257-4e70-bb46-320861ef45e2.pdf",
  "mimeType": "application/pdf",
  "size": 24533,
  "type": "driver_license",
  "uploadedAt": "2026-11-21T21:25:40.004Z"
}
```

Nombre original, nombre generado, ruta, tipo MIME, tamaño (bytes), tipo de documento y fecha de carga.

## Validaciones y errores

Todos usan el formato de error del proyecto (`{ status, error, message }`) y salen únicamente desde el middleware global.

| Código | HTTP | Cuándo |
|---|---|---|
| `FILE_REQUIRED` | 400 | No se envió ningún archivo |
| `INVALID_FILE_TYPE` | 400 | Tipo o extensión no permitidos |
| `INVALID_FILE_FIELD` | 400 | El archivo vino en un campo distinto al esperado (`document` / `proof`) o se enviaron varios |
| `INVALID_DOCUMENT_TYPE` | 400 | El `type` enviado no es válido |
| `FILE_TOO_LARGE` | 413 | El archivo supera los 5 MB |
| `UPLOAD_ERROR` | 500 | No se pudo guardar el archivo (el detalle interno no se muestra al cliente) |
| `USER_NOT_FOUND` / `ORDER_NOT_FOUND` | 404 | La entidad no existe |
| `UNAUTHORIZED` / `FORBIDDEN` | 401 / 403 | Sin sesión o sin permisos |

**No quedan archivos huérfanos:** si la carga falla después de que Multer ya guardó el archivo (usuario inexistente, tipo de documento inválido, falla de la base, etc.), el service lo borra.

## Logger

| Evento | Nivel |
|---|---|
| Documento cargado (usuario, tipo, archivo, tamaño) | `info` |
| Comprobante asociado a un pedido | `info` |
| Intento de subir un tipo de archivo no permitido, archivo demasiado grande, campo incorrecto, entidad inexistente | `warning` |
| Error al guardar el archivo o la base | `error` |

## Swagger

Los endpoints están documentados como `multipart/form-data` en `/api/docs` (tags **Users** y **Orders**), indicando el campo del archivo, el campo `type` y sus valores permitidos, los formatos y el tamaño máximo, la respuesta exitosa y todos los errores posibles. También se documentan los schemas `FileMetadata`, `DocumentType` y `UserDocumentsResponse`.

## Tests

```bash
npm test
```

`tests/uploads.test.js` cubre:

- **Carga correcta:** PDF, JPG y PNG; archivo de exactamente 5 MB; licencia en `licenses`; varios documentos que se acumulan; nombre malicioso y nombres con acentos; comprobante asociado al pedido. Se verifica la estructura de los metadatos, que el archivo exista en disco y que quede guardado en la base.
- **Errores:** archivo faltante, tipo inválido (varios casos), campo incorrecto, archivo demasiado grande, tipo de documento inválido, usuario o pedido inexistente, sin sesión, sin permisos, y fallas al guardar. En cada caso se verifica además que **no quede ningún archivo en el servidor**.

Los tests guardan los archivos en `uploads/test/`, que se limpia antes de cada test y al terminar la suite. `tests/swagger.test.js` comprueba que la documentación de los endpoints de carga coincida con la API.

## Archivos de esta entrega

```
src/
├── config/multer.config.js           # configuración centralizada de Multer
├── middlewares/upload.middleware.js  # middlewares de carga + traducción de errores
├── utils/file-storage.js             # mover/borrar archivos, metadatos
├── models/file.schema.js             # esquema de metadatos (documents / proofs)
├── dto/file.dto.js
├── services/users.service.js         # addUserDocument, getUserDocuments
├── services/orders.service.js        # addOrderProof
├── controllers/ · routes/ · repositories/
├── docs/                             # Swagger (multipart/form-data)
└── constants/index.js                # DOCUMENT_TYPES, UPLOAD_FOLDERS, FILE_UPLOAD
tests/
├── uploads.test.js
└── helpers/files.js
```
