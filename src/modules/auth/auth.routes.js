import express from "express";
import { activityMiddleware } from "../../lib/activityLogger.js";
import {
  login,
  logout,
  refresh,
  registerUser,
  resendVerificationOtp,
  verifyEmail,
  requestPasswordReset,
  verifyPasswordResetOTP,
  resetPassword,
} from "./auth.controller.js";
import { rateLimit } from "../../middlewares/rateLimit.middleware.js";
import { csrfProtect } from "../../middlewares/csrf.middleware.js";
import {
  loginLimiter,
  otpLimiter,
  refreshLimiter,
  passwordResetLimiter,
} from "../../lib/flexibleRateLimiter.js";

const router = express.Router();

router.post("/register", activityMiddleware("Auth", "User Registration"), rateLimit(otpLimiter), registerUser);
router.post("/verify-email", activityMiddleware("Auth", "Email Verification"), verifyEmail);
router.post("/resend-otp", resendVerificationOtp); // Less critical but can be added
router.post("/login", activityMiddleware("Auth", "User Login"), rateLimit(loginLimiter), login);
router.post("/refresh", rateLimit(refreshLimiter), csrfProtect, refresh);
router.post("/logout", activityMiddleware("Auth", "User Logout"), logout);

// Password reset routes
router.post("/password-reset/request", rateLimit(passwordResetLimiter), requestPasswordReset);
router.post("/password-reset/verify-otp", rateLimit(otpLimiter), verifyPasswordResetOTP);
router.post("/password-reset/reset", rateLimit(passwordResetLimiter), resetPassword);

export default router;
