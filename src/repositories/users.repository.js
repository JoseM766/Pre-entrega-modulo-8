import User from "../models/User.js";
import { isValidId } from "./helpers.js";

// Único archivo que conoce el modelo User.
// Por defecto NUNCA devuelve el hash de la contraseña ni el campo interno __v.
const PUBLIC_PROJECTION = "-password -__v";

export const findUserByEmail = (email) => {
  return User.findOne({ email }).select(PUBLIC_PROJECTION).lean();
};

// Solo para el login: es el único método que devuelve el hash, porque hay que compararlo.
export const findUserByEmailWithPassword = (email) => {
  return User.findOne({ email }).select("-__v").lean();
};

export const createUser = async (userData) => {
  const user = await User.create(userData);

  return user.toObject({
    versionKey: false,
    transform: (doc, ret) => {
      delete ret.password;
      return ret;
    },
  });
};

export const findUsers = async ({ filter, skip, limit }) => {
  const [data, total] = await Promise.all([
    User.find(filter).select(PUBLIC_PROJECTION).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    User.countDocuments(filter),
  ]);

  return { data, total };
};

export const findUserById = async (id) => {
  if (!isValidId(id)) return null;
  return User.findById(id).select(PUBLIC_PROJECTION).lean();
};

const withoutPassword = (doc) => {
  const { password, ...rest } = doc.toObject({ versionKey: false });
  return rest;
};

export const insertManyUsers = async (usersData) => {
  const docs = await User.insertMany(usersData);
  return docs.map(withoutPassword);
};

// Con límite: nunca se carga una colección completa en memoria.
export const findUsersByRole = (role, limit = 100) => {
  return User.find({ role }).select(PUBLIC_PROJECTION).sort({ createdAt: -1 }).limit(limit).lean();
};

// Agrega los metadatos de un documento al usuario y devuelve el usuario actualizado.
export const addDocumentToUser = async (userId, fileData) => {
  if (!isValidId(userId)) return null;
  return User.findByIdAndUpdate(userId, { $push: { documents: fileData } }, { new: true, runValidators: true })
    .select(PUBLIC_PROJECTION)
    .lean();
};
