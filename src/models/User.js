import mongoose from "mongoose";
import { USER_ROLES } from "../constants/index.js";
import { fileSchema } from "./file.schema.js";

const userSchema = new mongoose.Schema(
  {
    first_name: {
      type: String,
      required: true,
    },
    last_name: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    password: {
      type: String,
      required: true,
    },
    role: {
      type: String,
      enum: Object.values(USER_ROLES),
      default: USER_ROLES.USER,
    },
    // Documentos subidos (DNI, licencia, etc.): solo metadatos, el archivo está en uploads/
    documents: {
      type: [fileSchema],
      default: [],
    },
    // Solo se usa en repartidores (role DRIVER)
    isAvailable: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

const User = mongoose.model("User", userSchema);

export default User;
