import { logger } from "../config/logger.js";
import * as usersRepository from "../repositories/users.repository.js";
import {
  UserNotFoundError,
  ForbiddenError,
  FileRequiredError,
  InvalidDocumentTypeError,
  InvalidRoleError,
} from "../errors/index.js";
import { parsePagination, buildPage } from "../utils/pagination.js";
import {
  USER_ROLES,
  DOCUMENT_TYPES,
  USER_DOCUMENT_TYPES,
  DOCUMENT_TYPE_FOLDERS,
} from "../constants/index.js";
import { buildFileMetadata, moveToFolder, deleteFileQuietly } from "../utils/file-storage.js";

// Listado paginado y filtrable por rol (nunca devuelve la colección completa).
export const listUsers = async ({ role, page, limit }) => {
  if (role && !Object.values(USER_ROLES).includes(role)) {
    throw new InvalidRoleError();
  }

  const filter = {};
  if (role) filter.role = role;

  const pagination = parsePagination({ page, limit });
  const { data, total } = await usersRepository.findUsers({ filter, skip: pagination.skip, limit: pagination.limit });

  return buildPage({ data, total, page: pagination.page, limit: pagination.limit });
};

// El repository devuelve null si el id es inválido o no existe: el service decide qué error es.
export const getUserById = async (userId) => {
  const user = await usersRepository.findUserById(userId);

  if (!user) {
    throw new UserNotFoundError();
  }

  return user;
};

// Un usuario solo puede gestionar SUS documentos; el admin, los de cualquiera.
const assertCanManageDocuments = (requester, userId) => {
  if (requester.role !== USER_ROLES.ADMIN && String(requester.id) !== String(userId)) {
    throw new ForbiddenError();
  }
};

// --- Subir un documento de usuario ---
// Orden de validaciones: permisos -> el usuario existe -> hay archivo -> el tipo de documento es válido.
// Multer ya guardó el archivo en disco antes de llegar acá, por eso si algo falla se BORRA
// (no quedan archivos huérfanos).
export const addUserDocument = async ({ requester, userId, file, type }) => {
  let storedPath = file?.path;

  try {
    assertCanManageDocuments(requester, userId);

    const user = await usersRepository.findUserById(userId);
    if (!user) {
      throw new UserNotFoundError();
    }

    if (!file) {
      throw new FileRequiredError();
    }

    const documentType = type || DOCUMENT_TYPES.USER_DOCUMENT;
    if (!USER_DOCUMENT_TYPES.includes(documentType)) {
      throw new InvalidDocumentTypeError(
        `El tipo de documento debe ser uno de: ${USER_DOCUMENT_TYPES.join(", ")}`,
        `Recibido: ${JSON.stringify(type)}`
      );
    }

    // La carpeta depende del tipo: las licencias van a uploads/licenses
    const storedFile = await moveToFolder(file, DOCUMENT_TYPE_FOLDERS[documentType]);
    storedPath = storedFile.path;

    const metadata = buildFileMetadata(storedFile, documentType);
    const updatedUser = await usersRepository.addDocumentToUser(userId, metadata);

    logger.info(
      `Documento cargado: usuario ${userId}, tipo ${documentType}, archivo ${metadata.fileName} (${metadata.size} bytes)`
    );
    return updatedUser;
  } catch (error) {
    await deleteFileQuietly(storedPath);
    throw error;
  }
};

// --- Ver los documentos de un usuario ---
export const getUserDocuments = async ({ requester, userId }) => {
  assertCanManageDocuments(requester, userId);

  const user = await usersRepository.findUserById(userId);
  if (!user) {
    throw new UserNotFoundError();
  }

  return user;
};
