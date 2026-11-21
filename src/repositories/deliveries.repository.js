import Delivery from "../models/Delivery.js";
import { isValidId } from "./helpers.js";

// Único archivo que conoce el modelo Delivery.
const DEFAULT_PROJECTION = "-__v";
const DEFAULT_SORT = { createdAt: -1 };

export const createDelivery = async (deliveryData) => {
  const delivery = await Delivery.create(deliveryData);
  return delivery.toObject({ versionKey: false });
};

export const insertManyDeliveries = async (deliveriesData) => {
  const docs = await Delivery.insertMany(deliveriesData);
  return docs.map((doc) => doc.toObject({ versionKey: false }));
};

export const findDeliveryById = async (id) => {
  if (!isValidId(id)) return null;
  return Delivery.findById(id).select(DEFAULT_PROJECTION).lean();
};

export const findDeliveries = async ({ filter, skip, limit }) => {
  const [data, total] = await Promise.all([
    Delivery.find(filter).select(DEFAULT_PROJECTION).sort(DEFAULT_SORT).skip(skip).limit(limit).lean(),
    Delivery.countDocuments(filter),
  ]);

  return { data, total };
};

export const updateDeliveryStatusById = async (id, status) => {
  if (!isValidId(id)) return null;
  return Delivery.findByIdAndUpdate(id, { status }, { new: true }).select(DEFAULT_PROJECTION).lean();
};

export const findDeliveryByOrderId = async (orderId) => {
  if (!isValidId(orderId)) return null;
  return Delivery.findOne({ order: orderId }).select(DEFAULT_PROJECTION).lean();
};
