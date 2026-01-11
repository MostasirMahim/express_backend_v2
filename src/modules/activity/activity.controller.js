import activityLogger from "../../lib/activityLogger.js";
import ActivityLog from "./activity.model.js";
import { successResponse, errorResponse } from "../../utils/response.js";
import logger from "../../utils/logger.js";

/**
 * Get instant logs from Redis for Admin Dashboard
 */
export const getDashboardLogs = async (req, res) => {
  try {
    const logs = await activityLogger.getRecentLogs();
    return successResponse(res, 200, "Recent dashboard logs", logs);
  } catch (error) {
    logger.error(`Get Dashboard Logs Error: ${error.message}`);
    return errorResponse(res, 500, error.message);
  }
};

/**
 * Get historical logs from MongoDB with pagination
 */
export const getHistoricalLogs = async (req, res) => {
  try {
    const { page = 1, limit = 20, module, actor_id, startDate, endDate } = req.query;
    
    const query = {};
    if (module) query.module = module;
    if (actor_id) query.actor_id = actor_id;
    if (startDate || endDate) {
      query.occurred_at = {};
      if (startDate) query.occurred_at.$gte = new Date(startDate);
      if (endDate) query.occurred_at.$lte = new Date(endDate);
    }

    const logs = await ActivityLog.find(query)
      .sort({ occurred_at: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await ActivityLog.countDocuments(query);

    return successResponse(res, 200, "Historical activity logs", {
      logs,
      total,
      page: parseInt(page),
      totalPages: Math.ceil(total / limit)
    });
  } catch (error) {
    logger.error(`Get Historical Logs Error: ${error.message}`);
    return errorResponse(res, 500, error.message);
  }
};

/**
 * Manually delete logs based on criteria
 */
export const deleteLogs = async (req, res) => {
  try {
    const { days, module, actor_id } = req.body;
    
    const query = {};
    if (days) {
      const date = new Date();
      date.setDate(date.getDate() - days);
      query.occurred_at = { $lt: date };
    }
    if (module) query.module = module;
    if (actor_id) query.actor_id = actor_id;

    if (Object.keys(query).length === 0) {
      return errorResponse(res, 400, "Please provide at least one filter (days, module, or actor_id)");
    }

    const result = await ActivityLog.deleteMany(query);
    
    logger.info(`Admin deleted ${result.deletedCount} logs.`);
    return successResponse(res, 200, `Deleted ${result.deletedCount} logs successfully`);
  } catch (error) {
    logger.error(`Delete Logs Error: ${error.message}`);
    return errorResponse(res, 500, error.message);
  }
};

/**
 * Force flush Redis buffer to DB (Manual Trigger)
 */
export const flushLogsManually = async (req, res) => {
  try {
    await activityLogger.flushToDB();
    return successResponse(res, 200, "Logs flushed to database successfully");
  } catch (error) {
    return errorResponse(res, 500, error.message);
  }
};
