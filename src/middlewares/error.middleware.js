import logger from "../utils/logger.js";

const errorHandler = (err, req, res, next) => {
  logger.error(err.stack);
  const statusCode = res.statusCode ? res.statusCode : 500;
  res.status(statusCode);
  res.json({
    message: err.message || "Internal Server Error",
    stack: process.env.NODE_ENV === "production" ? null : err.stack,
  });
};

export default errorHandler;
