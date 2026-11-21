import * as ordersService from "../services/orders.service.js";
import { toOrderDTO } from "../dto/order.dto.js";

export const createOrder = async (req, res, next) => {
  try {
    const { items, deliveryAddress, priority } = req.body;

    const order = await ordersService.createOrder({
      customerId: req.user.id,
      items,
      deliveryAddress,
      priority,
    });

    res.status(201).json({ status: "success", payload: toOrderDTO(order) });
  } catch (error) {
    next(error);
  }
};

export const getOrders = async (req, res, next) => {
  try {
    const { status, page, limit } = req.query;
    const result = await ordersService.listOrders({ requester: req.user, status, page, limit });

    res.status(200).json({
      status: "success",
      data: result.data.map(toOrderDTO),
      page: result.page,
      limit: result.limit,
      total: result.total,
      totalPages: result.totalPages,
    });
  } catch (error) {
    next(error);
  }
};

export const getOrderById = async (req, res, next) => {
  try {
    const order = await ordersService.getOrderById({ requester: req.user, orderId: req.params.id });
    res.status(200).json({ status: "success", payload: toOrderDTO(order) });
  } catch (error) {
    next(error);
  }
};

export const uploadProof = async (req, res, next) => {
  try {
    const order = await ordersService.addOrderProof({
      requester: req.user,
      orderId: req.params.id,
      file: req.file,
    });

    res.status(201).json({
      status: "success",
      message: "Comprobante cargado correctamente",
      payload: toOrderDTO(order),
    });
  } catch (error) {
    next(error);
  }
};
