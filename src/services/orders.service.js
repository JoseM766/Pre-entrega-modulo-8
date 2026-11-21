import { logger } from "../config/logger.js";
import * as ordersRepository from "../repositories/orders.repository.js";
import * as deliveriesRepository from "../repositories/deliveries.repository.js";
import { USER_ROLES, ORDER_STATUS, DELIVERY_PRIORITY, DOCUMENT_TYPES } from "../constants/index.js";
import {
  MissingFieldsError,
  InvalidOrderItemsError,
  InvalidPriorityError,
  InvalidOrderStatusError,
  OrderNotFoundError,
  ForbiddenError,
  FileRequiredError,
} from "../errors/index.js";
import { buildFileMetadata, deleteFileQuietly } from "../utils/file-storage.js";
import { hasRequiredOrderFields, areValidOrderItems } from "../utils/validators.js";
import { parsePagination, buildPage } from "../utils/pagination.js";

// --- Crear pedido: el cliente es siempre el usuario autenticado, el estado inicial es CREATED ---
export const createOrder = async ({ customerId, items, deliveryAddress, priority }) => {
  if (!hasRequiredOrderFields({ items, deliveryAddress })) {
    throw new MissingFieldsError();
  }

  if (!areValidOrderItems(items)) {
    throw new InvalidOrderItemsError();
  }

  const finalPriority = priority ?? DELIVERY_PRIORITY.NORMAL;
  if (!Object.values(DELIVERY_PRIORITY).includes(finalPriority)) {
    throw new InvalidPriorityError();
  }

  const cleanItems = items.map(({ name, quantity, price }) => ({ name: name.trim(), quantity, price }));
  const total = cleanItems.reduce((acc, item) => acc + item.quantity * item.price, 0);

  const order = await ordersRepository.createOrder({
    customer: customerId,
    items: cleanItems,
    deliveryAddress,
    total,
    status: ORDER_STATUS.CREATED,
    priority: finalPriority,
  });

  logger.info(`Pedido creado: id ${order._id} (cliente ${customerId}, total ${total})`);
  return order;
};

// --- Listar pedidos: el admin ve todos; un cliente solo los suyos ---
export const listOrders = async ({ requester, status, page, limit }) => {
  if (status && !Object.values(ORDER_STATUS).includes(status)) {
    throw new InvalidOrderStatusError();
  }

  const filter = {};
  if (status) filter.status = status;
  if (requester.role !== USER_ROLES.ADMIN) filter.customer = requester.id;

  const pagination = parsePagination({ page, limit });
  const { data, total } = await ordersRepository.findOrders({
    filter,
    skip: pagination.skip,
    limit: pagination.limit,
  });

  return buildPage({ data, total, page: pagination.page, limit: pagination.limit });
};

// --- Consultar un pedido: el admin ve cualquiera; un cliente solo los suyos ---
export const getOrderById = async ({ requester, orderId }) => {
  const order = await ordersRepository.findOrderById(orderId);

  if (!order) {
    logger.warning(`Pedido no encontrado: id ${orderId}`);
    throw new OrderNotFoundError();
  }

  if (requester.role !== USER_ROLES.ADMIN && String(order.customer) !== String(requester.id)) {
    throw new ForbiddenError();
  }

  return order;
};

// --- Subir un comprobante de entrega al pedido ---
// Lo pueden hacer el admin o el repartidor al que se le asignó la entrega de ese pedido.
// Orden de validaciones: el pedido existe -> permisos -> hay archivo. Si algo falla, se borra
// el archivo que Multer ya guardó (no quedan archivos huérfanos).
export const addOrderProof = async ({ requester, orderId, file }) => {
  try {
    const order = await ordersRepository.findOrderById(orderId);
    if (!order) {
      logger.warning(`Pedido no encontrado: id ${orderId}`);
      throw new OrderNotFoundError();
    }

    if (requester.role !== USER_ROLES.ADMIN) {
      const delivery = await deliveriesRepository.findDeliveryByOrderId(orderId);
      if (!delivery || String(delivery.driver) !== String(requester.id)) {
        throw new ForbiddenError();
      }
    }

    if (!file) {
      throw new FileRequiredError();
    }

    const metadata = buildFileMetadata(file, DOCUMENT_TYPES.DELIVERY_PROOF);
    const updatedOrder = await ordersRepository.addProofToOrder(orderId, metadata);

    logger.info(`Comprobante asociado al pedido ${orderId}: ${metadata.fileName} (${metadata.size} bytes)`);
    return updatedOrder;
  } catch (error) {
    await deleteFileQuietly(file?.path);
    throw error;
  }
};
