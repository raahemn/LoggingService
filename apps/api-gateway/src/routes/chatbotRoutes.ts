import express from "express";
import { chat, confirmOperation, cancelOperation } from "../controllers/chatbotController";
import { authenticateJWT } from "../middlewares/auth";

const router = express.Router();

router.post("/chat", authenticateJWT, chat);
router.post("/operations/:operationId/confirm", authenticateJWT, confirmOperation);
router.post("/operations/:operationId/cancel", authenticateJWT, cancelOperation);

export default router;
