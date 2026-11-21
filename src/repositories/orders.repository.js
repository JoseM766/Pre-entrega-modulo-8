import Order from "../models/Order.js";
import { isValidId } from "./helpers.js";

// Único archivo que conoce el modelo Order.
const DEFAULT_PROJECTION = "-__v";
const DEFAULT_SORT = { createdAt: -1 };

export const createOrder = async (orderData) => {
  const order = await Order.create(orderData);
  return order.toObject({ versionKey: false });
};

export const insertManyOrders = async (ordersData) => {
  const docs = await Order.insertMany(ordersData);
  return docs.map((doc) => doc.toObject({ versionKey: false }));
};

export const findOrderById = async (id) => {
  if (!isValidId(id)) return null;
  return Order.findById(id).select(DEFAULT_PROJECTION).lean();
};

export const findOrders = async ({ filter, skip, limit }) => {
  const [data, total] = await Promise.all([
    Order.find(filter).select(DEFAULT_PROJECTION).sort(DEFAULT_SORT).skip(skip).limit(limit).lean(),
    Order.countDocuments(filter),
  ]);

  return { data, total };
};

export const updateOrderStatusById = async (id, status) => {
  if (!isValidId(id)) return null;
  return Order.findByIdAndUpdate(id, { status }, { new: true }).select(DEFAULT_PROJECTION).lean();
};

// Agrega los metadatos de un comprobante al pedido y devuelve el pedido actualizado.
export const addProofToOrder = async (orderId, fileData) => {
  if (!isValidId(orderId)) return null;
  return Order.findByIdAndUpdate(orderId, { $push: { proofs: fileData } }, { new: true, runValidators: true })
    .select(DEFAULT_PROJECTION)
    .lean();
};
