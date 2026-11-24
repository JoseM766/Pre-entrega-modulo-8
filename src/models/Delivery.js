import mongoose from "mongoose";
import { DELIVERY_STATUS, DELIVERY_PRIORITY } from "../constants/index.js";

const deliverySchema = new mongoose.Schema(
  {
    order: { type: mongoose.Schema.Types.ObjectId, ref: "Order", required: true, unique: true },
    driver: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    status: { type: String, enum: Object.values(DELIVERY_STATUS), default: DELIVERY_STATUS.ASSIGNED },
    priority: {
      type: String,
      enum: Object.values(DELIVERY_PRIORITY),
      default: DELIVERY_PRIORITY.NORMAL,
    },
  },
  { timestamps: true }
);

// Índices que respaldan los listados (filtro + orden por fecha). "order" ya es único.
deliverySchema.index({ driver: 1, createdAt: -1 });
deliverySchema.index({ status: 1, createdAt: -1 });

const Delivery = mongoose.model("Delivery", deliverySchema);
export default Delivery;
