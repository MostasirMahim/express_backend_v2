import { RateLimiterRedis } from "rate-limiter-flexible";
import redisClient from "../config/redis.js";



export const loginLimiter = new RateLimiterRedis({
  storeClient: redisClient,
  keyPrefix: "rl_login",
  points: 5,
  duration: 15 * 60,
  blockDuration: 15 * 60,
});

export const otpLimiter = new RateLimiterRedis({
  storeClient: redisClient,
  keyPrefix: "rl_otp",
  points: 3,
  duration: 10 * 60,
  blockDuration: 30 * 60,
});

export const refreshLimiter = new RateLimiterRedis({
  storeClient: redisClient,
  keyPrefix: "rl_refresh",
  points: 10,
  duration: 60 * 60,
  blockDuration: 60 * 60,
});
