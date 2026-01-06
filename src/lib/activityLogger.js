import redis from "../config/redis.js";
import ActivityLog from "../modules/activity/activity.model.js";
import logger from "../utils/logger.js";

const REDIS_BUFFER_KEY = "activity:buffer";
const REDIS_RECENT_KEY = "activity:recent";
const MAX_RECENT_LOGS = 100; // Keep 100 logs in Redis for instant dashboard
const FLUSH_THRESHOLD = 100;  // Flush to DB after 100 logs OR timer
const FLUSH_INTERVAL = 5 * 60 * 1000; // 5 minutes

class ActivityLogger {
  constructor() {
    this.flushTimer = null;
    this.initFlushTimer();
  }

  /**
   * Log an activity
   * @param {Object} data - Log data
   */
  async log(data) {
    try {
      const logEntry = {
        ...data,
        occurred_at: new Date().toISOString(),
      };

      const logString = JSON.stringify(logEntry);

      // 1. Push to buffer for DB flush
      await redis.rpush(REDIS_BUFFER_KEY, logString);

      // 2. Push to recent for instant dashboard and trim
      await redis.lpush(REDIS_RECENT_KEY, logString);
      await redis.ltrim(REDIS_RECENT_KEY, 0, MAX_RECENT_LOGS - 1);

      // 3. Check if threshold reached to flush manually
      const bufferLength = await redis.llen(REDIS_BUFFER_KEY);
      if (bufferLength >= FLUSH_THRESHOLD) {
        this.flushToDB();
      }
    } catch (error) {
      logger.error(`Activity Logger Error: ${error.message}`);
    }
  }

  /**
   * Setup periodic flush
   */
  initFlushTimer() {
    if (this.flushTimer) clearInterval(this.flushTimer);
    this.flushTimer = setInterval(() => {
      this.flushToDB();
    }, FLUSH_INTERVAL);
  }

  /**
   * Move logs from Redis buffer to MongoDB
   */
  async flushToDB() {
    try {
      // Use transactional-like approach: get logs and delete from list
      // Multi/Exec to ensure atomicity
      const [len] = await redis.multi().llen(REDIS_BUFFER_KEY).exec();
      const length = len[1];

      if (length === 0) return;

      // Get all logs currently in buffer
      const logs = await redis.lrange(REDIS_BUFFER_KEY, 0, length - 1);
      
      const parsedLogs = logs.map(l => JSON.parse(l));

      // Batch insert into MongoDB
      await ActivityLog.insertMany(parsedLogs);

      // Remove the processed logs from Redis
      await redis.ltrim(REDIS_BUFFER_KEY, length, -1);

      logger.info(`Successfully flushed ${length} activity logs to MongoDB.`);
    } catch (error) {
      logger.error(`Flush Activity Logs Error: ${error.message}`);
    }
  }

  /**
   * Get recent logs for Admin Dashboard (from Redis)
   */
  async getRecentLogs() {
    const logs = await redis.lrange(REDIS_RECENT_KEY, 0, -1);
    return logs.map(l => JSON.parse(l));
  }
}

const activityLogger = new ActivityLogger();

/**
 * Middleware for automatic activity logging
 * @param {string} moduleName - Name of the module
 * @param {string} actionName - Name of the action (optional override)
 */
export const activityMiddleware = (moduleName, actionName) => async (req, res, next) => {
  const originalJson = res.json;
  
  // Capture response to log after success
  res.json = function (data) {
    if (res.statusCode >= 200 && res.statusCode < 300) {
      // Capture context after potential auth middleware
      const logData = {
        actor_id: req.user?.id || req.body?.email || "anonymous",
        actor_type: req.user?.role === "admin" ? "Admin" : "User",
        action: actionName || `${req.method} ${req.path}`,
        module: moduleName,
        context: {
          ip: req.ip,
          userAgent: req.headers["user-agent"],
          path: req.originalUrl,
          method: req.method,
          requestId: req.requestId,
        },
        // You can add 'before' if you move this logic to specific controller/services
      };

      activityLogger.log(logData);
    }
    return originalJson.call(this, data);
  };
  
  next();
};

export default activityLogger;
