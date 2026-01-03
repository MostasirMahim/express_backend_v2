import { rateLimit } from "express-rate-limit";
import { RedisStore } from "rate-limit-redis";
import { errorResponse} from "../utils/response.js";
import logger from "../utils/logger.js";
import redisClient from "../config/redis.js";

const rateLimitOptions = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res, next) => {
    logger.error(`Rate limit exceeded for IP ${req.ip}`);
    return errorResponse(
      res,
      429,
      "Too many requests from this IP, please try again after an hour",
    );
  },
  store: new RedisStore({
    sendCommand: (command, ...args) => redisClient.call(command, ...args),
  }),
});

export default rateLimitOptions;
