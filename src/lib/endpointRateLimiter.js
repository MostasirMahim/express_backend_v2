import { rateLimit } from "express-rate-limit";
import logger from "../utils/logger.js";
import { errorResponse } from "../utils/response.js";
import { RedisStore } from "rate-limit-redis";
import redisClient from "../config/redis.js";


const sensitiveEndpointsLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5, // limit each IP to 5 requests per windowMs
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  handler: (req, res, next) => {
    logger.error(`Rate limit exceeded for IP ${req.ip}`);
    return errorResponse(
      res,
      429,
      "Too many requests from this IP, please try again after an hour"
    );
  },
  store: new RedisStore({
    sendCommand: (command, ...args) => redisClient.call(command, ...args),
  }),
});

export default sensitiveEndpointsLimiter;