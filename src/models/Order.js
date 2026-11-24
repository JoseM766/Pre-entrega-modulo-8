import mongoose from "mongoose";
import { ORDER_STATUS, DELIVERY_PRIORITY } from "../constants/index.js";
import { fileSchema } from "./file.schema.js";

const itemSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    quantity: { type: Number, required: true, min: 1 },
    price: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    customer: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    items: { type: [itemSchema], validate: (items) => items.length > 0 },
    deliveryAddress: { type: String, required: true, trim: true },
    total: { type: Number, required: true, min: 0 },
    // Comprobantes de entrega subidos: solo metadatos, el archivo está en uploads/proofs
    proofs: { type: [fileSchema], default: [] },
    status: { type: String, enum: Object.values(ORDER_STATUS), default: ORDER_STATUS.CREATED },
    priority: {
      type: String,
      enum: Object.values(DELIVERY_PRIORITY),
      default: DELIVERY_PRIORITY.NORMAL,
    },
  },
  { timestamps: true }
);

// Índices que respaldan los listados (filtro + orden por fecha): evitan recorrer toda la colección.
orderSchema.index({ customer: 1, createdAt: -1 });
orderSchema.index({ status: 1, createdAt: -1 });

const Order = mongoose.model("Order", orderSchema);
export default Order;
