import crypto from "crypto";

export const hashValue = (value) =>
  crypto.createHmac("sha256", process.env.TOKEN_SECRET).update(value).digest("hex");
