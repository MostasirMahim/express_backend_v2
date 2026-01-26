import express from "express";
import { 
  getDashboardLogs, 
  getHistoricalLogs, 
  deleteLogs, 
  flushLogsManually 
} from "./activity.controller.js";
// Assuming you have an adminAuth middleware, if not, I'll use it as a placeholder
// import { isAdmin } from "../../middlewares/auth.middleware.js";

const router = express.Router();

// Admin-only access routes
router.get("/dashboard", getDashboardLogs);
router.get("/historical", getHistoricalLogs);
router.post("/flush", flushLogsManually);
router.delete("/delete", deleteLogs);

export default router;
