import { logger } from "../config/logger.js";
import * as productsRepository from "../repositories/products.repository.js";
import { PRODUCT_STATUS, PRODUCT_SORT_FIELDS } from "../constants/index.js";
import { InvalidSortError, InvalidPriceError, InvalidProductStatusError, InvalidStockError, MissingFieldsError, ProductExistsError, ProductNotFoundError } from "../errors/index.js";
import {
  hasRequiredProductFields,
  isValidPrice,
  isValidStock,
} from "../utils/validators.js";

import { parsePagination, buildPage } from "../utils/pagination.js";

// Regla de negocio: el estado del producto depende de su stock.
// Sin stock no se puede vender, con stock sí. Nadie lo elige a mano.
const statusFromStock = (stock) => {
  return stock > 0 ? PRODUCT_STATUS.AVAILABLE : PRODUCT_STATUS.OUT_OF_STOCK;
};

// El repository devuelve null si el id es inválido o no existe: el service decide qué error es.
const findProductOrFail = async (productId) => {
  const product = await productsRepository.findProductById(productId);

  if (!product) {
    throw new ProductNotFoundError();
  }

  return product;
};

// --- Crear producto ---
export const createProduct = async ({ name, description, category, price, stock }) => {
  if (!hasRequiredProductFields({ name, description, category })) {
    throw new MissingFieldsError();
  }

  if (!isValidPrice(price)) {
    throw new InvalidPriceError();
  }

  const finalStock = stock === undefined ? 0 : stock;
  if (!isValidStock(finalStock)) {
    throw new InvalidStockError();
  }

  const existingProduct = await productsRepository.findProductByName(name.trim());
  if (existingProduct) {
    throw new ProductExistsError();
  }

  const product = await productsRepository.createProduct({
    name,
    description,
    category,
    price,
    stock: finalStock,
    status: statusFromStock(finalStock),
  });

  logger.info(`Producto creado: "${product.name}" (id ${product._id}, stock ${product.stock}, ${product.status})`);
  return product;
};

// --- Listar productos con filtros, paginación y ordenamiento ---
// Por defecto solo se muestran los productos AVAILABLE (con stock).
// Para ver los agotados hay que pedirlos: ?status=out_of_stock
export const listProducts = async ({ status, category, page, limit, sort }) => {
  const filter = {};

  if (status && !Object.values(PRODUCT_STATUS).includes(status)) {
    throw new InvalidProductStatusError();
  }

  filter.status = status || PRODUCT_STATUS.AVAILABLE;
  if (category) filter.category = category;

  const pagination = parsePagination({ page, limit });

  // sort=price o sort=-price (el "-" indica descendente); solo se permiten los campos de PRODUCT_SORT_FIELDS.
  // Sin sort, el repository usa su orden por defecto.
  let sortOption;
  if (sort) {
    const fields = sort.split(",").map((field) => field.trim());
    if (!fields.every((field) => PRODUCT_SORT_FIELDS.includes(field.replace(/^-/, "")))) {
      throw new InvalidSortError(`Solo se puede ordenar por: ${PRODUCT_SORT_FIELDS.join(", ")} (con "-" delante para descendente)`);
    }
    sortOption = fields.join(" ");
  }

  const { data, total } = await productsRepository.findProducts({
    filter,
    sort: sortOption,
    skip: pagination.skip,
    limit: pagination.limit,
  });

  return buildPage({ data, total, page: pagination.page, limit: pagination.limit });
};

// --- Consultar un producto por id ---
export const getProductById = async (productId) => {
  return findProductOrFail(productId);
};

// --- Actualizar un producto ---
export const updateProduct = async ({ productId, updateData }) => {
  await findProductOrFail(productId);

  // El status no se manda a mano: se recalcula solo cuando cambia el stock.
  const { status, ...safeUpdateData } = updateData;

  if (safeUpdateData.price !== undefined && !isValidPrice(safeUpdateData.price)) {
    throw new InvalidPriceError();
  }

  if (safeUpdateData.stock !== undefined) {
    if (!isValidStock(safeUpdateData.stock)) {
      throw new InvalidStockError();
    }
    safeUpdateData.status = statusFromStock(safeUpdateData.stock);
  }

  const updatedProduct = await productsRepository.updateProductById(productId, safeUpdateData);

  logger.info(`Producto actualizado: id ${productId} (${Object.keys(safeUpdateData).join(", ")})`);
  return updatedProduct;
};

// --- Eliminar un producto ---
export const deleteProduct = async (productId) => {
  await findProductOrFail(productId);
  const deletedProduct = await productsRepository.deleteProductById(productId);

  logger.info(`Producto eliminado: id ${productId}`);
  return deletedProduct;
};
