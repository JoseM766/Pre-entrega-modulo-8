import { toFileDTO } from "./file.dto.js";

export const toOrderItemDTO = (item) => ({
  name: item.name,
  quantity: item.quantity,
  price: item.price,
});

export const toOrderDTO = (order) => {
  if (!order) return null;

  return {
    id: order._id ?? order.id,
    customer: order.customer,
    items: order.items.map(toOrderItemDTO),
    deliveryAddress: order.deliveryAddress,
    total: order.total,
    status: order.status,
    priority: order.priority,
    proofs: (order.proofs ?? []).map(toFileDTO),
    createdAt: order.createdAt,
  };
};
