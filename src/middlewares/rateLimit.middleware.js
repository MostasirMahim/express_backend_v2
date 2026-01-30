export const rateLimit = (limiter) => async (req, res, next) => {
  try {
    const key = req.user?.id || req.ip; // per-user or per-IP
    await limiter.consume(key);
    next();
  } catch {
    res.status(429).json({ message: "Too many requests" });
  }
};
