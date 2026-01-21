import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import errorHandler from "./middlewares/error.middleware.js";
import rateLimitOptions from "./config/rateLimiter.js";
import routes from "./routes.js";
import { config } from "dotenv";
import logger from "./utils/logger.js";
import crypto from "crypto";
config();


const app = express();
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(cookieParser());

// Request ID Middleware
app.use((req, res, next) => {
    req.requestId = crypto.randomUUID();
    res.setHeader("X-Request-Id", req.requestId);
    next();
});

app.use(rateLimitOptions);

app.use("/api/v1", routes);

app.use((req, res, next) => {
    logger.info(`${req.method} ${req.url} ${req.ip}`);
    next();
})

app.use(errorHandler);

export default app;

