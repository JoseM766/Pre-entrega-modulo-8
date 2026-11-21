import { Router } from "express";
import { getOrders, getOrderById, createOrder, uploadProof } from "../controllers/orders.controller.js";
import { authenticate } from "../middlewares/auth.middleware.js";
import { authorize } from "../middlewares/authorize.middleware.js";
import { uploadProof as uploadProofFile } from "../middlewares/upload.middleware.js";
import { USER_ROLES } from "../constants/index.js";

const router = Router();

// Clientes y admin (los repartidores trabajan con entregas, no con pedidos)
const canUseOrders = [authenticate, authorize([USER_ROLES.USER, USER_ROLES.ADMIN])];

router.get("/", ...canUseOrders, getOrders);
router.get("/:id", ...canUseOrders, getOrderById);
router.post("/", ...canUseOrders, createOrder);

// Comprobante de entrega: lo sube el repartidor asignado (o un admin)
router.post("/:id/proof", authenticate, authorize([USER_ROLES.DRIVER, USER_ROLES.ADMIN]), uploadProofFile, uploadProof);

export default router;
