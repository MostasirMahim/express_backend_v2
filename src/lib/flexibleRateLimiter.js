import { RateLimiterRedis } from "rate-limiter-flexible";
import redisClient from "../config/redis.js";
import { errorResponse } from "../utils/response.js";
import logger from "../utils/logger.js";

/**
 * Flexible Rate Limiter Factory
 * Easy-to-use rate limiter creation with sensible defaults
 */

/**
 * Preset configurations for common use cases
 */
export const RATE_LIMIT_PRESETS = {
  // Very strict - for highly sensitive operations
  STRICT: {
    points: 3,
    duration: 60 * 60, // 1 hour
    blockDuration: 60 * 60, // 1 hour
  },
  
  // Moderate - for authentication endpoints
  AUTH: {
    points: 5,
    duration: 15 * 60, // 15 minutes
    blockDuration: 15 * 60, // 15 minutes
  },
  
  // Lenient - for general API endpoints
  GENERAL: {
    points: 20,
    duration: 60, // 1 minute
    blockDuration: 5 * 60, // 5 minutes
  },
  
  // Very lenient - for public endpoints
  PUBLIC: {
    points: 100,
    duration: 60, // 1 minute
    blockDuration: 60, // 1 minute
  },
  
  // OTP specific
  OTP: {
    points: 3,
    duration: 10 * 60, // 10 minutes
    blockDuration: 30 * 60, // 30 minutes
  },
  
  // Login specific
  LOGIN: {
    points: 5,
    duration: 15 * 60, // 15 minutes
    blockDuration: 15 * 60, // 15 minutes
  },
  
  // Password reset
  PASSWORD_RESET: {
    points: 3,
    duration: 60 * 60, // 1 hour
    blockDuration: 60 * 60, // 1 hour
  },
  
  // Email sending
  EMAIL: {
    points: 5,
    duration: 60 * 60, // 1 hour
    blockDuration: 60 * 60, // 1 hour
  }
};

/**
 * Create a flexible rate limiter with custom or preset configuration
 * 
 * @param {Object} options - Configuration options
 * @param {string} options.keyPrefix - Unique prefix for Redis keys
 * @param {number} options.points - Number of points (requests) allowed
 * @param {number} options.duration - Time window in seconds
 * @param {number} options.blockDuration - How long to block after limit exceeded (seconds)
 * @param {string} options.preset - Use a preset configuration (STRICT, AUTH, GENERAL, PUBLIC, etc.)
 * @returns {RateLimiterRedis} Rate limiter instance
 */
export const createRateLimiter = (options = {}) => {
  // Use preset if provided
  let config = {};
  if (options.preset && RATE_LIMIT_PRESETS[options.preset]) {
    config = { ...RATE_LIMIT_PRESETS[options.preset] };
  }
  
  // Override with custom options
  config = {
    storeClient: redisClient,
    keyPrefix: options.keyPrefix || "rl",
    points: options.points || config.points || 10,
    duration: options.duration || config.duration || 60,
    blockDuration: options.blockDuration || config.blockDuration || 60,
  };
  
  return new RateLimiterRedis(config);
};

/**
 * Middleware factory for easy rate limiting
 * 
 * @param {Object} options - Rate limiter options or RateLimiterRedis instance
 * @param {Function} options.keyGenerator - Custom function to generate rate limit key
 * @param {string} options.errorMessage - Custom error message
 * @returns {Function} Express middleware
 */
export const rateLimitMiddleware = (options = {}) => {
  // If options is already a RateLimiterRedis instance, use it
  const limiter = options instanceof RateLimiterRedis 
    ? options 
    : createRateLimiter(options);
  
  const keyGenerator = options.keyGenerator || ((req) => req.user?.id || req.ip);
  const errorMessage = options.errorMessage || "Too many requests. Please try again later.";
  
  return async (req, res, next) => {
    try {
      const key = keyGenerator(req);
      const result = await limiter.consume(key);
      
      // Add rate limit info to response headers
      res.set({
        'X-RateLimit-Limit': limiter.points,
        'X-RateLimit-Remaining': result.remainingPoints,
        'X-RateLimit-Reset': new Date(Date.now() + result.msBeforeNext).toISOString(),
      });
      
      next();
    } catch (rateLimiterRes) {
      // Rate limit exceeded
      const retrySecs = Math.ceil(rateLimiterRes.msBeforeNext / 1000);
      
      res.set({
        'X-RateLimit-Limit': limiter.points,
        'X-RateLimit-Remaining': 0,
        'X-RateLimit-Reset': new Date(Date.now() + rateLimiterRes.msBeforeNext).toISOString(),
        'Retry-After': retrySecs,
      });
      
      logger.warn(`Rate limit exceeded for ${keyGenerator(req)}`);
      
      return errorResponse(
        res,
        429,
        errorMessage,
        {
          retryAfter: retrySecs,
          limit: limiter.points,
        }
      );
    }
  };
};

/**
 * Pre-configured rate limiters for common use cases
 */
export const loginLimiter = createRateLimiter({
  preset: 'LOGIN',
  keyPrefix: 'rl_login',
});

export const otpLimiter = createRateLimiter({
  preset: 'OTP',
  keyPrefix: 'rl_otp',
});

export const refreshLimiter = createRateLimiter({
  preset: 'AUTH',
  keyPrefix: 'rl_refresh',
});

export const passwordResetLimiter = createRateLimiter({
  preset: 'PASSWORD_RESET',
  keyPrefix: 'rl_password_reset',
});

export const emailLimiter = createRateLimiter({
  preset: 'EMAIL',
  keyPrefix: 'rl_email',
});

export const registrationLimiter = createRateLimiter({
  preset: 'AUTH',
  keyPrefix: 'rl_registration',
});

/**
 * Sensitive endpoint rate limiter (very strict)
 */
export const sensitiveEndpointLimiter = createRateLimiter({
  preset: 'STRICT',
  keyPrefix: 'rl_sensitive',
});

/**
 * General API rate limiter
 */
export const generalApiLimiter = createRateLimiter({
  preset: 'GENERAL',
  keyPrefix: 'rl_api',
});

/**
 * Public endpoint rate limiter (lenient)
 */
export const publicEndpointLimiter = createRateLimiter({
  preset: 'PUBLIC',
  keyPrefix: 'rl_public',
});

/**
 * Helper function to manually consume points
 */
export const consumePoints = async (limiter, key, points = 1) => {
  try {
    await limiter.consume(key, points);
    return { success: true };
  } catch (error) {
    return {
      success: false,
      msBeforeNext: error.msBeforeNext,
      remainingPoints: error.remainingPoints,
    };
  }
};

/**
 * Helper function to get current rate limit status
 */
export const getRateLimitStatus = async (limiter, key) => {
  try {
    const res = await limiter.get(key);
    
    if (!res) {
      return {
        consumedPoints: 0,
        remainingPoints: limiter.points,
        isBlocked: false,
      };
    }
    
    return {
      consumedPoints: res.consumedPoints,
      remainingPoints: res.remainingPoints,
      msBeforeNext: res.msBeforeNext,
      isBlocked: res.consumedPoints >= limiter.points,
    };
  } catch (error) {
    logger.error(`Error getting rate limit status: ${error.message}`);
    return null;
  }
};

/**
 * Helper function to reset rate limit for a key
 */
export const resetRateLimit = async (limiter, key) => {
  try {
    await limiter.delete(key);
    logger.info(`Rate limit reset for key: ${key}`);
    return { success: true };
  } catch (error) {
    logger.error(`Error resetting rate limit: ${error.message}`);
    return { success: false, error: error.message };
  }
};

export default {
  createRateLimiter,
  rateLimitMiddleware,
  RATE_LIMIT_PRESETS,
  loginLimiter,
  otpLimiter,
  refreshLimiter,
  passwordResetLimiter,
  emailLimiter,
  registrationLimiter,
  sensitiveEndpointLimiter,
  generalApiLimiter,
  publicEndpointLimiter,
  consumePoints,
  getRateLimitStatus,
  resetRateLimit,
};
