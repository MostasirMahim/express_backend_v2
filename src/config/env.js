/**
 * Environment configuration
 * DEPRECATED: Use process.env directly.
 * 
 * Centralized configuration file for secrets, ports, and other env vars.
 * Avoid hardcoding values; easy to switch between dev/staging/prod
 */
/*
import dotenv from "dotenv";
dotenv.config();

export const env = {
  PORT: process.env.PORT || 5000,
  MONGO_URI: process.env.MONGO_URI,
  REDIS_URL: process.env.REDIS_URL,

  JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET,
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET,
  TOKEN_SECRET: process.env.TOKEN_SECRET,

  COOKIE_SECURE: process.env.NODE_ENV === "production",
};
*/
