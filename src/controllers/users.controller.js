import * as usersService from "../services/users.service.js";
import { toUserDTO } from "../dto/user.dto.js";
import { toFileDTO } from "../dto/file.dto.js";

export const listUsers = async (req, res, next) => {
  try {
    const users = await usersService.listUsers();
    res.status(200).json({ status: "success", payload: users.map(toUserDTO) });
  } catch (error) {
    next(error);
  }
};

export const getUserById = async (req, res, next) => {
  try {
    const user = await usersService.getUserById(req.params.id);
    res.status(200).json({ status: "success", payload: toUserDTO(user) });
  } catch (error) {
    next(error);
  }
};

const toDocumentsPayload = (user) => ({
  id: user._id ?? user.id,
  documents: (user.documents ?? []).map(toFileDTO),
});

export const uploadDocument = async (req, res, next) => {
  try {
    const user = await usersService.addUserDocument({
      requester: req.user,
      userId: req.params.id,
      file: req.file,
      type: req.body?.type,
    });

    res.status(201).json({
      status: "success",
      message: "Documento cargado correctamente",
      payload: toDocumentsPayload(user),
    });
  } catch (error) {
    next(error);
  }
};

export const getDocuments = async (req, res, next) => {
  try {
    const user = await usersService.getUserDocuments({ requester: req.user, userId: req.params.id });
    res.status(200).json({ status: "success", payload: toDocumentsPayload(user) });
  } catch (error) {
    next(error);
  }
};
