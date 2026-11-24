import mongoose from "mongoose";
import { PRODUCT_STATUS } from "../constants/index.js";

// Solo define el esquema: sin lógica de negocio ni de controllers.
const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, unique: true },
    description: { type: String, required: true, trim: true },
    category: { type: String, required: true, trim: true },
    price: { type: Number, required: true, min: 0 },
    stock: { type: Number, required: true, min: 0, default: 0 },
    status: {
      type: String,
      enum: Object.values(PRODUCT_STATUS),
      default: PRODUCT_STATUS.AVAILABLE,
    },
  },
  { timestamps: true }
);

// Índice que respalda el listado público (estado + categoría).
productSchema.index({ status: 1, category: 1 });

const Product = mongoose.model("Product", productSchema);
export default Product;
