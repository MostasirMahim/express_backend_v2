import express from "express";
import { authenticate } from "../../middlewares/auth.middleware.js";
import {
  getMyNotifications,
  markRead,
  markAllRead
} from "./notification.controller.js";

const router = express.Router();

router.use(authenticate); // Protect all routes

router.get("/", getMyNotifications);
router.patch("/:id/read", markRead);
router.patch("/read-all", markAllRead);

export default router;
