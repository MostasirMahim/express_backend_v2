import express from "express";
import authRoutes from "./modules/auth/auth.routes.js";
import activityRoutes from "./modules/activity/activity.routes.js";
import notificationRoutes from "./modules/notifications/notification.routes.js";

const router = express.Router();

router.use("/auth", authRoutes);
router.use("/activity", activityRoutes);
router.use("/notifications", notificationRoutes);

export default router;
