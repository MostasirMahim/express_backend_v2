import crypto from "crypto";
import { signAccessToken } from "../../utils/jwt.js";
import bcrypt from "bcryptjs";
import { errorResponse, successResponse } from "../../utils/response.js";
import { Token, User } from "./auth.model.js";
import {
  emailVerificationValidation,
  registraionValidation,
  loginValidation,
  passwordResetRequestValidation,
  passwordResetValidation,
} from "./auth.validator.js";
import {
  issueTokens,
  requestOTP as generateOTP,
  sendEmail,
  verifyOTP,
} from "./auth.services.js";
import { hashValue } from "../../utils/hash.js";
import logger from "../../utils/logger.js";
import {
  trackFailedLogin,
  clearLoginAttempts,
  isLoginLocked,
  trackFailedOTP,
  clearOTPAttempts,
  trackSuspiciousActivity,
  isSuspicious,
} from "../../lib/securityManager.js";
import redis from "../../config/redis.js";

export const registerUser = async (req, res) => {
  try {
    const { error } = registraionValidation(req.body);
    if (error) {
      logger.error(`registration validation error: ${error.message}`);
      return errorResponse(res, 400, error.details[0].message);
    }
    const { email, password, username } = req.body;
    const exists = await User.findOne({ email });

    if (exists) {
      if (exists.isEmailVerified) {
        return errorResponse(res, 400, "Email already exists");
      } else {
        const otp = await generateOTP(email);
        await sendEmail({
          to: email,
          subject: "Verify your email",
          text: `Your OTP: ${otp}`,
        });

        return successResponse(res, 201, "Signup successful. Verify email.");
      }
    }
    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(password, salt);
    await User.create({
      email,
      password: hashedPassword,
      username,
      isEmailVerified: false,
    });
    const otp = await generateOTP(email);
    await sendEmail({
      to: email,
      subject: "Verify email",
      text: `Your OTP: ${otp}`,
    });
    return successResponse(res, 201, "Signup successful. Verify email.");
  } catch (error) {
    logger.error(`registration error: ${error.message}`);
    return errorResponse(res, 500, error.message);
  }
};
export const verifyEmail = async (req, res) => {
  try {
    const { error } = emailVerificationValidation(req.body);
    if (error) {
      logger.error(`email verification validation error: ${error.message}`);
      return errorResponse(res, 400, error.details[0].message);
    }
    const { email, otp } = req.body;
    
    // Check if user is suspicious
    const suspiciousCheck = await isSuspicious(email);
    if (suspiciousCheck.suspicious) {
      return errorResponse(res, 403, suspiciousCheck.message);
    }
    
    try {
      await verifyOTP(email, otp);
      await User.updateOne({ email }, { isEmailVerified: true });
      
      // Clear OTP attempts on success
      await clearOTPAttempts(email);
      
      logger.info(`email verified: ${email}`);
      return successResponse(res, 200, "Email verified successfully");
    } catch (otpError) {
      // Track failed OTP attempt
      try {
        await trackFailedOTP(email);
      } catch (trackError) {
        // If tracking fails due to lock, return that error
        return errorResponse(res, 429, trackError.message);
      }
      
      return errorResponse(res, 400, otpError.message);
    }
  } catch (error) {
    logger.error(`email verification error: ${error.message}`);
    return errorResponse(res, 500, error.message);
  }
};

export const resendVerificationOtp = async (req, res) => {
  try {
    const { email } = req.body;

    if(!email) return errorResponse(res, 400, "Email is required");
    const otp = await generateOTP(email);
    await sendEmail({
      to: email,
      subject: "Verify your email",
      text: `Your OTP: ${otp}`,
    });
    return successResponse(res, 200, "OTP sent successfully");
  } catch (error) {
    logger.error(`resend verification otp error: ${error.message}`);
    return errorResponse(res, 500, error.message);
  }
};

export const login = async (req, res) => {
  try {
    const { error } = loginValidation(req.body);
    if (error) {
      logger.error(`login validation error: ${error.message}`);
      return errorResponse(res, 400, error.details[0].message);
    }
    const { email, password } = req.body;
    
    // Check if account is locked
    const lockCheck = await isLoginLocked(email);
    if (lockCheck.locked) {
      return errorResponse(res, 429, lockCheck.message);
    }
    
    // Check if user is flagged as suspicious
    const suspiciousCheck = await isSuspicious(email);
    if (suspiciousCheck.suspicious) {
      return errorResponse(res, 403, suspiciousCheck.message);
    }
    
    const user = await User.findOne({ email });
    if (!user) {
      // Track failed login attempt
      try {
        await trackFailedLogin(email);
      } catch (trackError) {
        return errorResponse(res, 429, trackError.message);
      }
      return errorResponse(res, 401, "Invalid credentials");
    }

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      // Track failed login attempt
      try {
        await trackFailedLogin(email);
      } catch (trackError) {
        return errorResponse(res, 429, trackError.message);
      }
      return errorResponse(res, 401, "Invalid credentials");
    }
    
    if (!user.isEmailVerified) {
      return errorResponse(res, 401, "Email not verified");
    }
    
    // Clear login attempts on successful login
    await clearLoginAttempts(email);
    
    const accessToken = await issueTokens({ user, req, res });
    const csrfToken = crypto.randomBytes(32).toString("hex");
    res.cookie("csrfToken", csrfToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/auth/refresh",
    });
    logger.info(`login successful: ${email}`);
    return successResponse(res, 200, "Login successful", { user, accessToken });
  } catch (error) {
    logger.error(`login error: ${error.message}`);
    return errorResponse(res, 500, error.message);
  }
};

export const refresh = async (req, res) => {
  try {
    const refreshToken = req.cookies.refreshToken;
    if (!refreshToken) {
      logger.warn(`refresh token not found`);
      return res.status(401).json({ message: "Refresh token not found" });
    }

    const tokenHash = hashValue(refreshToken);
    const storedToken = await Token.findOne({ tokenHash });
    if (
      !storedToken ||
      storedToken.usedAt ||
      storedToken.revokedAt ||
      storedToken.expiresAt < new Date()
    )
      return errorResponse(res, 401, "Invalid refresh token");

    storedToken.usedAt = new Date();
    await storedToken.save();

    const newRefreshToken = crypto.randomBytes(40).toString("hex");
    await Token.create({
      userId: storedToken.userId,
      tokenHash: hashValue(newRefreshToken),
      ip: req.ip,
      userAgent: req.headers["user-agent"],
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });

    const accessToken = signAccessToken(storedToken.userId);

    res.cookie("refreshToken", newRefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/auth/refresh",
    });

    return successResponse(res, 200, "Token refreshed", { accessToken });
  } catch (error) {
    logger.error(`refresh error: ${error.message}`);
    return errorResponse(res, 500, error.message);
  }
};

export const logout = async (req, res) => {
  try {
    const refreshToken = req.cookies.refreshToken;
    if (refreshToken) {
      await Token.updateMany(
        { tokenHash: hashValue(refreshToken) },
        { revokedAt: new Date() },
      );
    }
    res.clearCookie("refreshToken", { path: "/auth/refresh" });
    return successResponse(res, 200, "Logout successful");
  } catch (error) {
    logger.error(`logout error: ${error.message}`);
    return errorResponse(res, 500, error.message);
  }
};

/**
 * Request password reset - sends OTP to email
 */
export const requestPasswordReset = async (req, res) => {
  try {
    const { error } = passwordResetRequestValidation(req.body);
    if (error) {
      logger.error(`password reset request validation error: ${error.message}`);
      return errorResponse(res, 400, error.details[0].message);
    }
    
    const { email } = req.body;
    
    // Check if user exists
    const user = await User.findOne({ email });
    if (!user) {
      // Don't reveal if user exists or not for security
      return successResponse(res, 200, "If the email exists, a reset code has been sent.");
    }
    
    // Check if user is suspicious
    const suspiciousCheck = await isSuspicious(email);
    if (suspiciousCheck.suspicious) {
      return errorResponse(res, 403, suspiciousCheck.message);
    }
    
    try {
      // Generate and send OTP
      const otp = await generateOTP(email);
      await sendEmail({
        to: email,
        subject: "Password Reset Request",
        text: `Your password reset OTP: ${otp}. This code will expire in 10 minutes.`,
      });
      
      logger.info(`Password reset OTP sent to ${email}`);
      return successResponse(res, 200, "If the email exists, a reset code has been sent.");
    } catch (otpError) {
      logger.error(`Error generating OTP for password reset: ${otpError.message}`);
      return errorResponse(res, 429, otpError.message);
    }
  } catch (error) {
    logger.error(`password reset request error: ${error.message}`);
    return errorResponse(res, 500, error.message);
  }
};

/**
 * Verify password reset OTP and issue a temporary reset token
 */
export const verifyPasswordResetOTP = async (req, res) => {
  try {
    const { error } = emailVerificationValidation(req.body);
    if (error) {
      logger.error(`password reset OTP validation error: ${error.message}`);
      return errorResponse(res, 400, error.details[0].message);
    }
    
    const { email, otp } = req.body;
    
    // Check if user is suspicious
    const suspiciousCheck = await isSuspicious(email);
    if (suspiciousCheck.suspicious) {
      return errorResponse(res, 403, suspiciousCheck.message);
    }
    
    try {
      // Verify OTP
      await verifyOTP(email, otp);
      
      // Clear OTP attempts on success
      await clearOTPAttempts(email);
      
      // Generate a temporary reset token (valid for 15 minutes)
      const resetToken = crypto.randomBytes(32).toString("hex");
      const resetTokenHash = hashValue(resetToken);
      
      // Store reset token in Redis with 15-minute expiry
      await redis.set(
        `password_reset:${email}`,
        resetTokenHash,
        "EX",
        15 * 60 // 15 minutes
      );
      
      logger.info(`Password reset OTP verified for ${email}`);
      
      return successResponse(res, 200, "OTP verified. You can now reset your password.", {
        resetToken,
        expiresIn: 900 // 15 minutes in seconds
      });
    } catch (otpError) {
      // Track failed OTP attempt
      try {
        await trackFailedOTP(email);
      } catch (trackError) {
        return errorResponse(res, 429, trackError.message);
      }
      
      return errorResponse(res, 400, otpError.message);
    }
  } catch (error) {
    logger.error(`password reset OTP verification error: ${error.message}`);
    return errorResponse(res, 500, error.message);
  }
};

/**
 * Complete password reset with verified token
 */
export const resetPassword = async (req, res) => {
  try {
    const { error } = passwordResetValidation(req.body);
    if (error) {
      logger.error(`password reset validation error: ${error.message}`);
      return errorResponse(res, 400, error.details[0].message);
    }
    
    const { email, resetToken, newPassword } = req.body;
    
    // Check if user is suspicious
    const suspiciousCheck = await isSuspicious(email);
    if (suspiciousCheck.suspicious) {
      return errorResponse(res, 403, suspiciousCheck.message);
    }
    
    // Verify reset token
    const storedTokenHash = await redis.get(`password_reset:${email}`);
    if (!storedTokenHash) {
      await trackSuspiciousActivity(email, "expired_reset_token");
      return errorResponse(res, 400, "Reset token expired or invalid. Please request a new one.");
    }
    
    const resetTokenHash = hashValue(resetToken);
    if (storedTokenHash !== resetTokenHash) {
      await trackSuspiciousActivity(email, "invalid_reset_token");
      return errorResponse(res, 400, "Invalid reset token.");
    }
    
    // Update password
    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(newPassword, salt);
    
    await User.updateOne({ email }, { password: hashedPassword });
    
    // Delete reset token
    await redis.del(`password_reset:${email}`);
    
    // Revoke all existing refresh tokens for security
    await Token.updateMany(
      { userId: (await User.findOne({ email }))._id },
      { revokedAt: new Date() }
    );
    
    logger.info(`Password reset successful for ${email}`);
    
    return successResponse(res, 200, "Password reset successful. Please login with your new password.");
  } catch (error) {
    logger.error(`password reset error: ${error.message}`);
    return errorResponse(res, 500, error.message);
  }
};
