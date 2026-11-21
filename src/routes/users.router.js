import { Router } from "express";
import { listUsers, getUserById, uploadDocument, getDocuments } from "../controllers/users.controller.js";
import { authenticate } from "../middlewares/auth.middleware.js";
import { authorize } from "../middlewares/authorize.middleware.js";
import { uploadUserDocument } from "../middlewares/upload.middleware.js";
import { USER_ROLES } from "../constants/index.js";

const router = Router();

router.get("/", authenticate, authorize([USER_ROLES.ADMIN]), listUsers);
router.get("/:id", authenticate, authorize([USER_ROLES.ADMIN]), getUserById);

// Documentos del usuario (cualquier usuario autenticado sobre SUS documentos; el admin, sobre los de todos)
router.get("/:id/documents", authenticate, getDocuments);
router.post("/:id/documents", authenticate, uploadUserDocument, uploadDocument);

export default router;
