import redis from "../config/redis.js";
import logger from "../utils/logger.js";

/**
 * Centralized Security Manager for handling suspicious activities
 * Tracks failed login attempts, wrong OTPs, and other security events
 */

// Configuration constants
const SECURITY_CONFIG = {
  // Login attempt tracking
  LOGIN_MAX_ATTEMPTS: 5,
  LOGIN_LOCK_DURATION: 60 * 60, // 1 hour in seconds
  LOGIN_ATTEMPT_WINDOW: 15 * 60, // 15 minutes

  // OTP verification tracking
  OTP_MAX_ATTEMPTS: 6,
  OTP_LOCK_DURATION: 60 * 60, // 1 hour
  
  // Password reset tracking
  RESET_MAX_ATTEMPTS: 3,
  RESET_LOCK_DURATION: 30 * 60, // 30 minutes
  
  // General suspicious activity
  SUSPICIOUS_THRESHOLD: 10, // Total suspicious actions before permanent flag
  SUSPICIOUS_WINDOW: 24 * 60 * 60, // 24 hours
};

/**
 * Track failed login attempt
 */
export const trackFailedLogin = async (identifier) => {
  const key = `security:login:${identifier}`;
  const lockKey = `security:login:lock:${identifier}`;
  
  try {
    // Check if already locked
    const isLocked = await redis.get(lockKey);
    if (isLocked) {
      const ttl = await redis.ttl(lockKey);
      throw new Error(`Account temporarily locked. Try again in ${Math.ceil(ttl / 60)} minutes.`);
    }

    // Increment failed attempts
    const attempts = await redis.incr(key);
    
    // Set expiry on first attempt
    if (attempts === 1) {
      await redis.expire(key, SECURITY_CONFIG.LOGIN_ATTEMPT_WINDOW);
    }

    logger.warn(`Failed login attempt ${attempts}/${SECURITY_CONFIG.LOGIN_MAX_ATTEMPTS} for ${identifier}`);

    // Lock account if max attempts reached
    if (attempts >= SECURITY_CONFIG.LOGIN_MAX_ATTEMPTS) {
      await redis.set(lockKey, "1", "EX", SECURITY_CONFIG.LOGIN_LOCK_DURATION);
      await redis.del(key);
      
      // Track as suspicious activity
      await trackSuspiciousActivity(identifier, "multiple_failed_logins");
      
      logger.error(`Account locked due to multiple failed login attempts: ${identifier}`);
      throw new Error(`Too many failed login attempts. Account locked for ${SECURITY_CONFIG.LOGIN_LOCK_DURATION / 60} minutes.`);
    }

    return {
      attemptsLeft: SECURITY_CONFIG.LOGIN_MAX_ATTEMPTS - attempts,
      attempts
    };
  } catch (error) {
    throw error;
  }
};

/**
 * Clear login attempts on successful login
 */
export const clearLoginAttempts = async (identifier) => {
  const key = `security:login:${identifier}`;
  await redis.del(key);
  logger.info(`Cleared login attempts for ${identifier}`);
};

/**
 * Check if user is locked from login
 */
export const isLoginLocked = async (identifier) => {
  const lockKey = `security:login:lock:${identifier}`;
  const isLocked = await redis.get(lockKey);
  
  if (isLocked) {
    const ttl = await redis.ttl(lockKey);
    return {
      locked: true,
      remainingTime: ttl,
      message: `Account locked. Try again in ${Math.ceil(ttl / 60)} minutes.`
    };
  }
  
  return { locked: false };
};

/**
 * Track failed OTP verification
 */
export const trackFailedOTP = async (identifier) => {
  const key = `security:otp:${identifier}`;
  const lockKey = `security:otp:lock:${identifier}`;
  
  try {
    // Check if already locked
    const isLocked = await redis.get(lockKey);
    if (isLocked) {
      const ttl = await redis.ttl(lockKey);
      throw new Error(`OTP verification locked. Try again in ${Math.ceil(ttl / 60)} minutes.`);
    }

    // Increment failed attempts
    const attempts = await redis.incr(key);
    
    // Set expiry on first attempt
    if (attempts === 1) {
      await redis.expire(key, 600); // 10 minutes
    }

    logger.warn(`Failed OTP attempt ${attempts}/${SECURITY_CONFIG.OTP_MAX_ATTEMPTS} for ${identifier}`);

    // Lock if max attempts reached
    if (attempts >= SECURITY_CONFIG.OTP_MAX_ATTEMPTS) {
      await redis.set(lockKey, "1", "EX", SECURITY_CONFIG.OTP_LOCK_DURATION);
      await redis.del(key);
      
      // Track as suspicious activity
      await trackSuspiciousActivity(identifier, "multiple_failed_otps");
      
      logger.error(`OTP verification locked due to multiple failures: ${identifier}`);
      throw new Error(`Too many failed OTP attempts. Locked for ${SECURITY_CONFIG.OTP_LOCK_DURATION / 60} minutes.`);
    }

    return {
      attemptsLeft: SECURITY_CONFIG.OTP_MAX_ATTEMPTS - attempts,
      attempts
    };
  } catch (error) {
    throw error;
  }
};

/**
 * Clear OTP attempts on successful verification
 */
export const clearOTPAttempts = async (identifier) => {
  const key = `security:otp:${identifier}`;
  await redis.del(key);
  logger.info(`Cleared OTP attempts for ${identifier}`);
};

/**
 * Track suspicious activity
 */
export const trackSuspiciousActivity = async (identifier, activityType) => {
  const key = `security:suspicious:${identifier}`;
  const flagKey = `security:suspicious:flag:${identifier}`;
  
  try {
    // Increment suspicious activity count
    const count = await redis.incr(key);
    
    // Set expiry on first suspicious activity
    if (count === 1) {
      await redis.expire(key, SECURITY_CONFIG.SUSPICIOUS_WINDOW);
    }

    // Log the activity
    const activityKey = `security:suspicious:log:${identifier}`;
    const activityLog = {
      type: activityType,
      timestamp: new Date().toISOString(),
      count
    };
    await redis.lpush(activityKey, JSON.stringify(activityLog));
    await redis.ltrim(activityKey, 0, 99); // Keep last 100 activities
    await redis.expire(activityKey, SECURITY_CONFIG.SUSPICIOUS_WINDOW);

    logger.warn(`Suspicious activity tracked for ${identifier}: ${activityType} (count: ${count})`);

    // Flag as highly suspicious if threshold reached
    if (count >= SECURITY_CONFIG.SUSPICIOUS_THRESHOLD) {
      await redis.set(flagKey, "1", "EX", SECURITY_CONFIG.SUSPICIOUS_WINDOW);
      logger.error(`User flagged as highly suspicious: ${identifier}`);
      
      return {
        flagged: true,
        count,
        message: "Account flagged for suspicious activity. Please contact support."
      };
    }

    return { flagged: false, count };
  } catch (error) {
    logger.error(`Error tracking suspicious activity: ${error.message}`);
    throw error;
  }
};

/**
 * Check if user is flagged as suspicious
 */
export const isSuspicious = async (identifier) => {
  const flagKey = `security:suspicious:flag:${identifier}`;
  const isFlagged = await redis.get(flagKey);
  
  if (isFlagged) {
    const key = `security:suspicious:${identifier}`;
    const count = await redis.get(key);
    
    return {
      suspicious: true,
      count: parseInt(count) || 0,
      message: "Account flagged for suspicious activity. Please contact support."
    };
  }
  
  return { suspicious: false };
};

/**
 * Get suspicious activity log
 */
export const getSuspiciousActivityLog = async (identifier) => {
  const activityKey = `security:suspicious:log:${identifier}`;
  const logs = await redis.lrange(activityKey, 0, -1);
  
  return logs.map(log => JSON.parse(log));
};

/**
 * Clear all security flags for a user (admin function)
 */
export const clearSecurityFlags = async (identifier) => {
  const keys = [
    `security:login:${identifier}`,
    `security:login:lock:${identifier}`,
    `security:otp:${identifier}`,
    `security:otp:lock:${identifier}`,
    `security:suspicious:${identifier}`,
    `security:suspicious:flag:${identifier}`,
    `security:suspicious:log:${identifier}`
  ];
  
  await Promise.all(keys.map(key => redis.del(key)));
  logger.info(`Cleared all security flags for ${identifier}`);
  
  return { success: true, message: "Security flags cleared" };
};

/**
 * Get security status for a user
 */
export const getSecurityStatus = async (identifier) => {
  const loginLock = await isLoginLocked(identifier);
  const suspicious = await isSuspicious(identifier);
  
  const loginAttempts = await redis.get(`security:login:${identifier}`) || 0;
  const otpAttempts = await redis.get(`security:otp:${identifier}`) || 0;
  
  return {
    identifier,
    loginLocked: loginLock.locked,
    loginAttempts: parseInt(loginAttempts),
    otpAttempts: parseInt(otpAttempts),
    suspicious: suspicious.suspicious,
    suspiciousCount: suspicious.count || 0,
    timestamp: new Date().toISOString()
  };
};

export default {
  trackFailedLogin,
  clearLoginAttempts,
  isLoginLocked,
  trackFailedOTP,
  clearOTPAttempts,
  trackSuspiciousActivity,
  isSuspicious,
  getSuspiciousActivityLog,
  clearSecurityFlags,
  getSecurityStatus,
  SECURITY_CONFIG
};
