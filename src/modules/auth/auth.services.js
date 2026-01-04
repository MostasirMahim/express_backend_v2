import nodemailer from "nodemailer";
import crypto from "crypto";
import { hashValue } from "../../utils/hash.js";
import { signAccessToken } from "../../utils/jwt.js";
import { Token } from "./auth.model.js";
import logger from "../../utils/logger.js";
import redis from "../../config/redis.js";
import { errorResponse } from "../../utils/response.js";

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

export const sendEmail = async ({ to, subject, text }) => {
  try{
    await transporter.sendMail({
    from: `"Auth System" <${process.env.EMAIL_USER}>`,
    to,
    subject,
    text,
  }, (err, info)=> {
    if (err) {
      logger.error(`Error sending email: ${err.message}`);
      return errorResponse(res, 500, err.message);
    }
  })
  logger.info(`Email sent to ${to}`);
  
  } catch (error) {
    logger.error(`Error sending email: ${error.message}`);
    return errorResponse(res, 500, error.message);
  }

};

const OTP_TTL = 600;
const MAX_ATTEMPTS = 6;
const LOCK_TIME = 60 * 60;

export const requestOTP = async (email) => {
  const lockKey = `otp:lock:${email}`;
  if (await redis.get(lockKey)) throw new Error("User temporarily locked");

  const cooldownKey = `otp:cooldown:${email}`;
  if (await redis.get(cooldownKey))
    throw new Error("Please wait before requesting another OTP");

  const countKey = `otp:cooldown:count:${email}`;
  const count = await redis.incr(countKey);
  if (count === 1) await redis.expire(countKey, 6 * 60 * 60); 

  let cooldown = 60;
  if (count >= 3) cooldown = 30 * 60;

  await redis.set(cooldownKey, "1", "EX", cooldown);

  const otp = crypto.randomInt(100000, 999999).toString();

  await redis.set(
    `otp:data:${email}`,
    JSON.stringify({ hash: hashValue(otp), attempts: 0 }),
    "EX",
    OTP_TTL,
  );

  return otp;
};

export const verifyOTP = async (email, otp) => {
  const lockKey = `otp:lock:${email}`;
  if (await redis.get(lockKey)) throw new Error("User locked");

  const key = `otp:data:${email}`;
  const data = await redis.get(key);
  if (!data) throw new Error("OTP expired");

  const parsed = JSON.parse(data);

  if (hashValue(otp) !== parsed.hash) {
    parsed.attempts++;
     if (parsed.attempts >= MAX_ATTEMPTS) {
       await redis.set(lockKey, "1", "EX", LOCK_TIME);
       await redis.del(key);
       await redis.del(`otp:cooldown:${email}`);
       await redis.del(`otp:cooldown:count:${email}`);
       throw new Error("Too many attempts. User locked.");
     }

    await redis.set(key, JSON.stringify(parsed), "EX", OTP_TTL);
    throw new Error("Invalid OTP");
  }

  await redis.del(key);
  await redis.del(`otp:cooldown:${email}`);
  await redis.del(`otp:cooldown:count:${email}`);
};

export const issueTokens = async ({ user, req, res }) => {
  const accessToken = signAccessToken(user._id);
  const refreshToken = crypto.randomBytes(40).toString("hex");

  await Token.create({
    userId: user._id,
    tokenHash: hashValue(refreshToken),
    ip: req.ip,
    userAgent: req.headers["user-agent"],
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  });
  
  res.cookie("refreshToken", refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/auth/refresh",
  });

  return accessToken;
};
